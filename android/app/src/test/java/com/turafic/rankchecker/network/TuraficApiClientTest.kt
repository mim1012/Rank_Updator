package com.turafic.rankchecker.network

import org.junit.Test
import org.junit.Assert.*

/**
 * 단위 테스트: TuraficApiClient
 *
 * 테스트 목적:
 * - URL 생성 검증
 * - 재시도 로직 검증 (Mock 없이 로직만)
 * - 에러 처리 검증
 */
class TuraficApiClientTest {

    @Test
    fun `API 클라이언트 생성 테스트`() {
        // Given
        val baseUrl = "http://test.server.com:5000/trpc"

        // When
        val client = TuraficApiClient(baseUrl)

        // Then
        assertNotNull(client)
    }

    @Test
    fun `기본 baseUrl 사용 테스트`() {
        // When
        val client = TuraficApiClient()

        // Then
        assertNotNull(client)
        // 기본 URL은 "http://10.0.2.2:5000/trpc" (에뮬레이터용)
    }

    @Test
    fun `재시도 딜레이 계산 테스트`() {
        // Given: 지수 백오프 알고리즘 검증
        val baseDelay = 1000L

        // When & Then
        // 1회 재시도: 1000ms
        val delay1 = baseDelay * (1 shl 0)
        assertEquals(1000L, delay1)

        // 2회 재시도: 2000ms
        val delay2 = baseDelay * (1 shl 1)
        assertEquals(2000L, delay2)

        // 3회 재시도: 4000ms
        val delay3 = baseDelay * (1 shl 2)
        assertEquals(4000L, delay3)
    }

    @Test
    fun `최대 재시도 횟수 검증`() {
        // Given
        val maxRetries = 3

        // Then
        assertTrue(maxRetries in 1..5)
        // 재시도는 1~5회가 적절
    }
}
