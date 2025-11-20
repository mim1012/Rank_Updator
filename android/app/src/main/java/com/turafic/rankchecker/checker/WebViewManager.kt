package com.turafic.rankchecker.checker

import android.util.Log
import android.webkit.*
import com.turafic.rankchecker.models.RankCheckTask
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * WebView 관리자
 * PRD Section 2.2.3 기반
 */
class WebViewManager(private val webView: WebView) {

    private var pageLoadComplete = CompletableDeferred<Boolean>()

    /**
     * WebView 초기화
     * @param task 순위 체크 작업
     */
    fun initialize(task: RankCheckTask) {
        Log.d(TAG, "Initializing WebView for task: ${task.taskId}")

        // WebView 설정
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            userAgentString = task.variables.userAgent
            cacheMode = WebSettings.LOAD_NO_CACHE
            blockNetworkImage = false  // 이미지 로드 허용
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // 쿠키 설정
        setupCookies(task)

        // WebViewClient 설정
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")
                pageLoadComplete.complete(true)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                Log.e(TAG, "Page load error: ${error?.description}")
                pageLoadComplete.completeExceptionally(Exception("Page load error: ${error?.description}"))
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                Log.w(TAG, "HTTP error: ${errorResponse?.statusCode}")
            }
        }

        // WebChromeClient 설정 (JavaScript console.log 출력)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d(TAG, "JS Console: ${consoleMessage?.message()}")
                return true
            }
        }

        Log.i(TAG, "WebView initialized successfully")
    }

    /**
     * 쿠키 설정
     * @param task 순위 체크 작업
     */
    private fun setupCookies(task: RankCheckTask) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // 기존 쿠키 삭제
        cookieManager.removeAllCookies(null)

        // 새 쿠키 설정
        task.variables.cookies?.forEach { (key, value) ->
            val cookieString = "$key=$value; domain=.naver.com; path=/"
            cookieManager.setCookie(".naver.com", cookieString)
            Log.d(TAG, "Cookie set: $key")
        }

        cookieManager.flush()
        Log.i(TAG, "Cookies configured: ${task.variables.cookies?.keys?.joinToString()}")
    }

    /**
     * URL 로드
     * @param url 로드할 URL
     */
    fun loadUrl(url: String) {
        pageLoadComplete = CompletableDeferred()
        Log.d(TAG, "Loading URL: $url")
        webView.loadUrl(url)
    }

    /**
     * 페이지 로드 완료 대기
     * @throws Exception 페이지 로드 실패 시
     */
    suspend fun waitForPageLoad() {
        try {
            pageLoadComplete.await()
            Log.d(TAG, "Page load completed")
        } catch (e: Exception) {
            Log.e(TAG, "Page load failed", e)
            throw e
        }
    }

    /**
     * JavaScript 실행
     * @param script JavaScript 코드
     * @return 실행 결과 (JSON 문자열)
     */
    suspend fun evaluateJavaScript(script: String): String = suspendCancellableCoroutine { continuation ->
        webView.post {
            webView.evaluateJavascript(script) { result ->
                val cleanedResult = result?.trim('"') ?: ""
                Log.v(TAG, "JavaScript result length: ${cleanedResult.length}")
                continuation.resume(cleanedResult)
            }
        }
    }

    /**
     * 페이지 하단까지 스크롤
     */
    fun scrollToBottom() {
        webView.post {
            webView.evaluateJavascript("window.scrollTo(0, document.body.scrollHeight);", null)
            Log.d(TAG, "Scrolled to bottom")
        }
    }

    /**
     * WebView 리소스 정리
     */
    fun destroy() {
        webView.destroy()
        Log.d(TAG, "WebView destroyed")
    }

    companion object {
        private const val TAG = "WebViewManager"
    }
}
