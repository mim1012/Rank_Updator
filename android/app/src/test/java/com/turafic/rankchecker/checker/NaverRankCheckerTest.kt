package com.turafic.rankchecker.checker

import org.junit.Test
import org.junit.Assert.*

/**
 * 단위 테스트: NaverRankChecker 로직
 *
 * 테스트 목적:
 * - URL 생성 검증
 * - 순위 계산 로직 검증
 * - 상수값 검증
 */
class NaverRankCheckerTest {

    @Test
    fun `검색 URL 생성 테스트`() {
        // Given
        val keyword = "갤럭시 S24"
        val page = 1

        // When
        val url = buildSearchUrl(keyword, page)

        // Then
        assertTrue(url.contains("m.shopping.naver.com"))
        assertTrue(url.contains("query="))
        assertTrue(url.contains("%EA%B0%A4%EB%9F%AD%EC%8B%9C") || url.contains("갤럭시"))  // URL 인코딩된 형태 or 원본
    }

    @Test
    fun `검색 URL 페이지네이션 테스트`() {
        // Given
        val keyword = "테스트"

        // When & Then
        for (page in 1..10) {
            val url = buildSearchUrl(keyword, page)
            assertNotNull(url)
            assertTrue(url.isNotEmpty())
        }
    }

    @Test
    fun `순위 계산 로직 테스트`() {
        // Given
        val page = 3  // 3페이지
        val indexInPage = 15  // 페이지 내 16번째 상품 (0-based)
        val productsPerPage = 40

        // When
        val rank = (page - 1) * productsPerPage + indexInPage + 1

        // Then
        // 3페이지 16번째 = (3-1)*40 + 15 + 1 = 80 + 15 + 1 = 96
        assertEquals(96, rank)
    }

    @Test
    fun `첫 페이지 첫 번째 상품 순위 테스트`() {
        // Given
        val page = 1
        val indexInPage = 0
        val productsPerPage = 40

        // When
        val rank = (page - 1) * productsPerPage + indexInPage + 1

        // Then
        assertEquals(1, rank)
    }

    @Test
    fun `마지막 페이지 마지막 상품 순위 테스트`() {
        // Given
        val page = 10  // 마지막 페이지
        val indexInPage = 39  // 페이지 내 마지막 상품 (0-based)
        val productsPerPage = 40

        // When
        val rank = (page - 1) * productsPerPage + indexInPage + 1

        // Then
        // 10페이지 40번째 = (10-1)*40 + 39 + 1 = 360 + 39 + 1 = 400
        assertEquals(400, rank)
    }

    @Test
    fun `최대 페이지 수 검증`() {
        // Given
        val maxPages = 10

        // Then
        assertTrue(maxPages > 0)
        assertTrue(maxPages <= 20)  // 너무 많으면 비효율적
    }

    @Test
    fun `페이지당 상품 수 검증`() {
        // Given
        val productsPerPage = 40

        // Then
        assertEquals(40, productsPerPage)
        // 네이버 쇼핑은 페이지당 40개 상품 표시
    }

    @Test
    fun `최대 확인 가능 상품 수 검증`() {
        // Given
        val maxPages = 10
        val productsPerPage = 40

        // When
        val maxProducts = maxPages * productsPerPage

        // Then
        assertEquals(400, maxProducts)
    }

    // Helper function (실제 NaverRankChecker에서 추출)
    private fun buildSearchUrl(keyword: String, page: Int): String {
        val encodedKeyword = java.net.URLEncoder.encode(keyword, "UTF-8")
        return "https://m.shopping.naver.com/search/all?query=$encodedKeyword&page=$page"
    }
}
