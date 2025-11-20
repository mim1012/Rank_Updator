package com.turafic.rankchecker.checker

import android.util.Log
import android.webkit.WebView
import com.turafic.rankchecker.models.Product
import com.turafic.rankchecker.models.RankCheckTask
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.net.URLEncoder

/**
 * 네이버 순위 체크 로직
 * PRD Section 7 기반
 */
class NaverRankChecker(
    private val webView: WebView,
    private val webViewManager: WebViewManager
) {

    /**
     * 순위 체크 메인 로직
     * @param task 순위 체크 작업
     * @return 순위 (못 찾으면 -1)
     */
    suspend fun checkRank(task: RankCheckTask): Int {
        Log.i(TAG, "=== RANK CHECK START ===")
        Log.i(TAG, "Keyword: ${task.keyword}")
        Log.i(TAG, "Product ID: ${task.productId}")
        Log.i(TAG, "User-Agent: ${task.variables.userAgent.take(50)}...")

        try {
            // 1. WebView 초기화
            webViewManager.initialize(task)

            // 2. 페이지별 검색 (최대 10페이지)
            for (page in 1..MAX_PAGES) {
                Log.d(TAG, "--- Checking page $page/$MAX_PAGES ---")

                val url = buildSearchUrl(task.keyword, page)
                Log.d(TAG, "URL: $url")

                // 페이지 로드
                webViewManager.loadUrl(url)
                webViewManager.waitForPageLoad()

                // 로드 후 대기
                delay(2000)

                // JavaScript로 상품 목록 추출
                val products = extractProducts()
                Log.d(TAG, "Products found: ${products.size}")

                // 타겟 상품 찾기
                for ((index, product) in products.withIndex()) {
                    if (product.mid1 == task.productId) {
                        val rank = (page - 1) * PRODUCTS_PER_PAGE + index + 1
                        Log.i(TAG, "=== PRODUCT FOUND AT RANK $rank ===")
                        return rank
                    }
                }

                // 페이지 하단까지 스크롤
                webViewManager.scrollToBottom()
                delay(1000)
            }

            Log.w(TAG, "=== PRODUCT NOT FOUND (checked ${MAX_PAGES * PRODUCTS_PER_PAGE} products) ===")
            return -1

        } catch (e: Exception) {
            Log.e(TAG, "=== RANK CHECK ERROR ===", e)
            throw e
        }
    }

    /**
     * 검색 URL 생성
     * @param keyword 검색 키워드
     * @param page 페이지 번호 (1부터 시작)
     * @return 네이버 쇼핑 검색 URL
     */
    private fun buildSearchUrl(keyword: String, page: Int): String {
        val encodedKeyword = URLEncoder.encode(keyword, "UTF-8")
        return "https://msearch.shopping.naver.com/search/all" +
                "?query=$encodedKeyword" +
                "&pagingIndex=$page" +
                "&sort=rel" +
                "&viewType=list" +
                "&productSet=total"
    }

    /**
     * JavaScript로 상품 목록 추출
     * PRD Section 7.2 기반
     * @return 상품 목록
     */
    private suspend fun extractProducts(): List<Product> {
        val js = """
            (function() {
                try {
                    var products = document.querySelectorAll('[data-product-id]');
                    var result = [];
                    for (var i = 0; i < products.length; i++) {
                        var mid1 = products[i].getAttribute('data-product-id');
                        if (mid1) {
                            result.push({ index: i, mid1: mid1 });
                        }
                    }
                    return JSON.stringify(result);
                } catch (e) {
                    return JSON.stringify({ error: e.message });
                }
            })();
        """.trimIndent()

        val result = webViewManager.evaluateJavaScript(js)
        return parseProducts(result)
    }

    /**
     * JSON 파싱
     * @param json JavaScript 실행 결과 (JSON 문자열)
     * @return 상품 목록
     */
    private fun parseProducts(json: String): List<Product> {
        return try {
            if (json.isEmpty() || json == "null") {
                Log.w(TAG, "Empty JSON result")
                return emptyList()
            }

            // JSON 파싱
            val products = Json.decodeFromString<List<Product>>(json)
            Log.d(TAG, "Parsed ${products.size} products")

            // 디버그 로그 (첫 3개만)
            products.take(3).forEach { product ->
                Log.v(TAG, "Product ${product.index}: ${product.mid1}")
            }

            products
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse products JSON: $json", e)
            emptyList()
        }
    }

    companion object {
        private const val TAG = "NaverRankChecker"
        private const val PRODUCTS_PER_PAGE = 40
        private const val MAX_PAGES = 10
    }
}
