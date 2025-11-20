package com.turafic.rankchecker.models

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import org.junit.Test
import org.junit.Assert.*

/**
 * 단위 테스트: RankCheckTask 데이터 모델
 *
 * 테스트 목적:
 * - JSON 직렬화/역직렬화 검증
 * - 데이터 무결성 확인
 */
class RankCheckTaskTest {

    @Test
    fun `RankCheckTask 직렬화 테스트`() {
        // Given
        val task = RankCheckTask(
            taskId = "task-12345",
            campaignId = 1,
            keyword = "갤럭시 S24",
            productId = "12345678",
            platform = "naver",
            variables = TaskVariables(
                userAgent = "Mozilla/5.0 (Linux; Android 13)",
                cookieStrategy = "login",
                referer = "https://m.shopping.naver.com",
                secFetchSite = "none",
                cookies = mapOf(
                    "NNB" to "test_nnb",
                    "NID_AUT" to "test_aut"
                )
            )
        )

        // When
        val json = Json.encodeToString(task)

        // Then
        assertNotNull(json)
        assertTrue(json.contains("task-12345"))
        assertTrue(json.contains("갤럭시 S24"))
    }

    @Test
    fun `RankCheckTask 역직렬화 테스트`() {
        // Given
        val json = """
            {
                "taskId": "task-67890",
                "campaignId": 2,
                "keyword": "아이폰 15",
                "productId": "87654321",
                "platform": "naver",
                "variables": {
                    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
                    "cookieStrategy": "nologin",
                    "referer": "https://m.shopping.naver.com",
                    "secFetchSite": "same-origin",
                    "cookies": null
                }
            }
        """.trimIndent()

        // When
        val task = Json.decodeFromString<RankCheckTask>(json)

        // Then
        assertEquals("task-67890", task.taskId)
        assertEquals(2, task.campaignId)
        assertEquals("아이폰 15", task.keyword)
        assertEquals("87654321", task.productId)
        assertEquals("naver", task.platform)
        assertEquals("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", task.variables.userAgent)
        assertEquals("nologin", task.variables.cookieStrategy)
        assertNull(task.variables.cookies)
    }

    @Test
    fun `TaskVariables 쿠키 없이 생성 테스트`() {
        // Given
        val variables = TaskVariables(
            userAgent = "Test UA",
            cookieStrategy = "nologin",
            referer = "https://test.com",
            secFetchSite = "none"
        )

        // Then
        assertNull(variables.cookies)
        assertEquals("nologin", variables.cookieStrategy)
    }

    @Test
    fun `TaskVariables 쿠키 포함 생성 테스트`() {
        // Given
        val cookies = mapOf(
            "NNB" to "cookie1",
            "NID_AUT" to "cookie2",
            "NID_SES" to "cookie3"
        )

        val variables = TaskVariables(
            userAgent = "Test UA",
            cookieStrategy = "login",
            referer = "https://test.com",
            secFetchSite = "same-site",
            cookies = cookies
        )

        // Then
        assertNotNull(variables.cookies)
        assertEquals(3, variables.cookies?.size)
        assertEquals("cookie1", variables.cookies?.get("NNB"))
        assertEquals("cookie2", variables.cookies?.get("NID_AUT"))
        assertEquals("cookie3", variables.cookies?.get("NID_SES"))
    }
}
