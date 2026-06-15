use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::{Duration, Instant};

const MAX_RESPONSE_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct HttpFetchResult {
    pub status: u16,
    pub final_url: String,
    pub content_type: Option<String>,
    /// Response body as UTF-8 (lossy); suitable for JSON/YAML OpenAPI specs.
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpReplayRequest {
    pub url: String,
    pub method: String,
    pub headers: BTreeMap<String, String>,
    pub query: Vec<(String, String)>,
    pub body_kind: String,
    pub body: Option<String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpReplayResult {
    pub status: u16,
    pub status_text: String,
    pub final_url: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    pub duration_ms: u128,
    pub size_bytes: usize,
}

fn validate_http_url(url: &str) -> Result<&str, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("URL 不能为空".into());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("仅支持完整的 http(s) 链接".into());
    }
    Ok(url)
}

/// GET request from the Tauri host (no browser CORS). For loading OpenAPI/Swagger documents.
#[tauri::command]
pub async fn http_fetch_get(url: String, headers: Vec<(String, String)>) -> Result<HttpFetchResult, String> {
    let url = validate_http_url(&url)?;

    let client = reqwest::Client::builder()
        .user_agent("DevKit/0.1 (+https://github.com/tauri-apps/tauri)")
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

    let mut req = client.get(url);
    for (k, v) in headers {
        let k = k.trim().to_string();
        if k.is_empty() {
            continue;
        }
        req = req.header(k, v);
    }

    let resp = req.send().await.map_err(|e| format!("请求失败: {e}"))?;
    let final_url = resp.url().to_string();
    let status = resp.status().as_u16();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let bytes = resp.bytes().await.map_err(|e| format!("读取响应体失败: {e}"))?;
    let body = String::from_utf8_lossy(&bytes).into_owned();

    Ok(HttpFetchResult {
        status,
        final_url,
        content_type,
        body,
    })
}

#[tauri::command]
pub async fn http_replay_send(input: HttpReplayRequest) -> Result<HttpReplayResult, String> {
    let url = validate_http_url(&input.url)?;
    let method = Method::from_bytes(input.method.trim().to_uppercase().as_bytes())
        .map_err(|_| format!("不支持的请求方法: {}", input.method))?;
    let allows_body = method != Method::GET && method != Method::HEAD;
    let has_content_type = input
        .headers
        .keys()
        .any(|key| key.eq_ignore_ascii_case("content-type"));
    let timeout_ms = input.timeout_ms.clamp(100, 300_000);
    let client = reqwest::Client::builder()
        .user_agent("DevKit/0.1")
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

    let mut request = client.request(method, url).query(&input.query);
    for (key, value) in input.headers {
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        request = request.header(key, value);
    }

    if allows_body {
        if let Some(body) = input.body {
        request = match input.body_kind.as_str() {
            "none" => request,
            "json" if !has_content_type => request
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body),
            "form" if !has_content_type => request
                .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                .body(body),
            _ => request.body(body),
        };
        }
    }

    let started = Instant::now();
    let response = request
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;
    let duration_ms = started.elapsed().as_millis();
    let status = response.status();
    let final_url = response.url().to_string();
    let response_headers = response
        .headers()
        .iter()
        .map(|(key, value)| {
            (
                key.to_string(),
                value.to_str().unwrap_or("<binary header>").to_string(),
            )
        })
        .collect();

    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("响应体超过 5 MB，已停止读取".into());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取响应体失败: {e}"))?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("响应体超过 5 MB，已停止展示".into());
    }
    let size_bytes = bytes.len();
    let body = String::from_utf8_lossy(&bytes).into_owned();

    Ok(HttpReplayResult {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        final_url,
        headers: response_headers,
        body,
        duration_ms,
        size_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::{http_replay_send, validate_http_url, HttpReplayRequest};
    use std::collections::BTreeMap;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;

    #[test]
    fn accepts_http_and_https_urls() {
        assert_eq!(
            validate_http_url(" https://api.example.com/users ").unwrap(),
            "https://api.example.com/users"
        );
        assert!(validate_http_url("http://localhost:3000/ping").is_ok());
    }

    #[test]
    fn rejects_empty_and_relative_urls() {
        assert!(validate_http_url("").is_err());
        assert!(validate_http_url("/api/users").is_err());
        assert!(validate_http_url("file:///tmp/a").is_err());
    }

    #[test]
    fn sends_query_headers_and_json_body() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(&mut stream);
            let mut request_line = String::new();
            reader.read_line(&mut request_line).unwrap();
            let mut headers = Vec::new();
            let mut content_length = 0;
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                if line == "\r\n" || line.is_empty() {
                    break;
                }
                if let Some(value) = line
                    .to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .map(str::trim)
                {
                    content_length = value.parse::<usize>().unwrap();
                }
                headers.push(line);
            }
            let mut body = vec![0; content_length];
            reader.read_exact(&mut body).unwrap();
            tx.send((request_line, headers.join(""), String::from_utf8(body).unwrap()))
                .unwrap();

            stream
                .write_all(
                    b"HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}",
                )
                .unwrap();
        });

        let mut headers = BTreeMap::new();
        headers.insert("X-Debug".into(), "devkit".into());
        let result = tauri::async_runtime::block_on(http_replay_send(HttpReplayRequest {
            url: format!("http://{address}/users"),
            method: "POST".into(),
            headers,
            query: vec![("page".into(), "1".into())],
            body_kind: "json".into(),
            body: Some("{\"name\":\"Ada\"}".into()),
            timeout_ms: 5_000,
        }))
        .unwrap();
        let (request_line, request_headers, request_body) = rx.recv().unwrap();

        assert_eq!(request_line, "POST /users?page=1 HTTP/1.1\r\n");
        assert!(request_headers.to_ascii_lowercase().contains("x-debug: devkit"));
        assert!(request_headers
            .to_ascii_lowercase()
            .contains("content-type: application/json"));
        assert_eq!(request_body, "{\"name\":\"Ada\"}");
        assert_eq!(result.status, 201);
        assert_eq!(result.body, "{\"ok\":true}");
        assert_eq!(result.size_bytes, 11);
    }
}
