package com.turafic.rankchecker.models

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import org.junit.Test
import org.junit.Assert.*

/**
 * 단위 테스트: TrpcResponse 모델
 *
 * 테스트 목적:
 * - tRPC 응답 파싱 검증
 * - 다양한 응답 타입 처리 확인
 */
class TrpcResponseTest {

    @Test
    fun `TrpcResponse 정수 결과 역직렬화 테스트`() {
        // Given: registerBot 응답 (botId 반환)
        val json = """
            {
                "result": {
                    "data": 123
                }
            }
        """.trimIndent()

        // When
        val response = Json.decodeFromString<TrpcResponse<Int>>(json)

        // Then
        assertNotNull(response.result)
        assertEquals(123, response.result?.data)
    }

    @Test
    fun `TrpcResponse RankCheckTask 역직렬화 테스트`() {
        // Given: getTask 응답
        val json = """
            {
                "result": {
                    "data": {
                        "taskId": "task-abc",
                        "campaignId": 5,
                        "keyword": "노트북",
                        "productId": "11111111",
                        "platform": "naver",
                        "variables": {
                            "userAgent": "Mozilla/5.0",
                            "cookieStrategy": "login",
                            "referer": "https://m.shopping.naver.com",
                            "secFetchSite": "none",
                            "cookies": {
                                "NNB": "test"
                            }
                        }
                    }
                }
            }
        """.trimIndent()

        // When
        val response = Json.decodeFromString<TrpcResponse<RankCheckTask>>(json)

        // Then
        assertNotNull(response.result)
        assertNotNull(response.result?.data)
        assertEquals("task-abc", response.result?.data?.taskId)
        assertEquals(5, response.result?.data?.campaignId)
        assertEquals("노트북", response.result?.data?.keyword)
    }

    @Test
    fun `TrpcResponse null data 처리 테스트`() {
        // Given: getTask 응답 (작업 없음)
        val json = """
            {
                "result": {
                    "data": null
                }
            }
        """.trimIndent()

        // When
        val response = Json { ignoreUnknownKeys = true }
            .decodeFromString<TrpcResponse<RankCheckTask?>>(json)

        // Then
        assertNotNull(response.result)
        assertNull(response.result?.data)
    }

    @Test
    fun `TrpcResponse Boolean 결과 역직렬화 테스트`() {
        // Given: reportRank 성공 응답
        val json = """
            {
                "result": {
                    "data": true
                }
            }
        """.trimIndent()

        // When
        val response = Json.decodeFromString<TrpcResponse<Boolean>>(json)

        // Then
        assertNotNull(response.result)
        assertEquals(true, response.result?.data)
    }

    @Test
    fun `TrpcResponse 직렬화 테스트`() {
        // Given
        val response = TrpcResponse(
            result = TrpcResult(data = 999)
        )

        // When
        val json = Json.encodeToString(response)

        // Then
        assertNotNull(json)
        assertTrue(json.contains("999"))
        assertTrue(json.contains("result"))
        assertTrue(json.contains("data"))
    }
}
