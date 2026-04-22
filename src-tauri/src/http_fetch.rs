use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HttpFetchResult {
    pub status: u16,
    pub final_url: String,
    pub content_type: Option<String>,
    /// Response body as UTF-8 (lossy); suitable for JSON/YAML OpenAPI specs.
    pub body: String,
}

/// GET request from the Tauri host (no browser CORS). For loading OpenAPI/Swagger documents.
#[tauri::command]
pub async fn http_fetch_get(url: String, headers: Vec<(String, String)>) -> Result<HttpFetchResult, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("URL 不能为空".into());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("仅支持 http(s) 链接".into());
    }

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
