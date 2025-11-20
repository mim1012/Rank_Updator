package com.turafic.rankchecker

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.turafic.rankchecker.network.TuraficApiClient
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 통합 테스트: Turafic 서버와의 실제 통신 테스트
 *
 * 실행 조건:
 * 1. Turafic 서버가 실행 중이어야 함 (npm run dev:windows)
 * 2. 서버 주소: http://10.0.2.2:5000/trpc (Android Emulator)
 * 3. 실제 디바이스 테스트 시 서버 IP 변경 필요
 *
 * 실행 방법:
 * ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
class IntegrationTest {

    private lateinit var apiClient: TuraficApiClient
    private val testDeviceId = "test-android-${System.currentTimeMillis()}"
    private val testLoginId = "test_login_id"
    private val testImei = "test_imei_${System.currentTimeMillis()}"

    @Before
    fun setup() {
        // Android Emulator용 서버 URL
        apiClient = TuraficApiClient("http://10.0.2.2:5000/trpc")
    }

    @Test
    fun useAppContext() {
        // Context 검증
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.turafic.rankchecker", appContext.packageName)
    }

    @Test
    fun testBotRegistration() = runBlocking {
        // Given: 새 봇 등록
        val deviceModel = "Test Android Device"

        // When: 봇 등록 API 호출
        val botId = apiClient.registerBot(testDeviceId, deviceModel)

        // Then: botId가 정상적으로 반환되어야 함
        assertNotNull("Bot ID should not be null", botId)
        assertTrue("Bot ID should be positive", botId!! > 0)
    }

    @Test
    fun testGetTaskWorkflow() = runBlocking {
        // Given: 봇 등록
        val deviceModel = "Test Android Device"
        val botId = apiClient.registerBot(testDeviceId, deviceModel)
        assertNotNull("Bot registration failed", botId)

        // When: 작업 요청
        val task = apiClient.getTask(botId!!, testLoginId, testImei)

        // Then: 작업이 있을 수도 있고 없을 수도 있음
        // 작업이 있으면 필수 필드 검증
        task?.let {
            assertNotNull("Task ID should not be null", it.taskId)
            assertNotNull("Keyword should not be null", it.keyword)
            assertNotNull("Product ID should not be null", it.productId)
            assertTrue("Campaign ID should be positive", it.campaignId > 0)
            assertEquals("Platform should be naver", "naver", it.platform)
            assertNotNull("User-Agent should not be null", it.variables.userAgent)
            assertNotNull("Referer should not be null", it.variables.referer)
            assertNotNull("Sec-Fetch-Site should not be null", it.variables.secFetchSite)
            assertTrue("Cookie strategy should be valid",
                it.variables.cookieStrategy in listOf("login", "nologin"))
        }
    }

    @Test
    fun testCompleteWorkflow() = runBlocking {
        // Given: 봇 등록
        val deviceModel = "Test Android Device"
        val botId = apiClient.registerBot(testDeviceId, deviceModel)
        assertNotNull("Bot registration failed", botId)

        // When: 작업 요청
        val task = apiClient.getTask(botId!!, testLoginId, testImei)

        if (task != null) {
            // 작업이 있는 경우 전체 워크플로우 테스트
            println("Received task: ${task.taskId}")
            println("Keyword: ${task.keyword}")
            println("Product ID: ${task.productId}")

            // 순위 체크 시뮬레이션 (실제로는 WebView에서 수행)
            val mockRank = 15
            val mockTotalProducts = 400

            // 순위 보고
            val reportSuccess = apiClient.reportRank(
                taskId = task.taskId,
                campaignId = task.campaignId,
                rank = mockRank,
                success = true,
                totalProducts = mockTotalProducts,
                pageNumber = 1,
                errorMessage = null
            )
            assertTrue("Report rank should succeed", reportSuccess)

            // 작업 완료
            val finishSuccess = apiClient.finishTask(task.taskId, botId)
            assertTrue("Finish task should succeed", finishSuccess)

            // 봇 상태 업데이트
            val statusSuccess = apiClient.updateBotStatus(botId, "online")
            assertTrue("Update bot status should succeed", statusSuccess)
        } else {
            // 작업이 없는 경우
            println("No tasks available - This is acceptable for testing")
        }
    }

    @Test
    fun testBotStatusUpdate() = runBlocking {
        // Given: 봇 등록
        val deviceModel = "Test Android Device"
        val botId = apiClient.registerBot(testDeviceId, deviceModel)
        assertNotNull("Bot registration failed", botId)

        // When: 봇 상태 업데이트 (online)
        val onlineSuccess = apiClient.updateBotStatus(botId!!, "online")
        assertTrue("Update to online should succeed", onlineSuccess)

        // When: 봇 상태 업데이트 (offline)
        val offlineSuccess = apiClient.updateBotStatus(botId, "offline")
        assertTrue("Update to offline should succeed", offlineSuccess)

        // When: 봇 상태 업데이트 (error)
        val errorSuccess = apiClient.updateBotStatus(botId, "error")
        assertTrue("Update to error should succeed", errorSuccess)
    }

    @Test
    fun testErrorHandling() = runBlocking {
        // Given: 존재하지 않는 botId
        val invalidBotId = -1

        // When: 잘못된 botId로 작업 요청
        val task = apiClient.getTask(invalidBotId, testLoginId, testImei)

        // Then: null이 반환되어야 함 (에러 발생)
        assertNull("Task should be null for invalid botId", task)
    }

    @Test
    fun testRetryMechanism() = runBlocking {
        // Given: 잘못된 서버 URL (재시도 테스트)
        val badClient = TuraficApiClient("http://10.0.2.2:9999/trpc")

        // When: 연결할 수 없는 서버에 요청
        val startTime = System.currentTimeMillis()
        val botId = badClient.registerBot(testDeviceId, "Test Device")
        val endTime = System.currentTimeMillis()

        // Then: 재시도 후 실패 (null 반환)
        assertNull("Should return null after retries", botId)

        // 재시도로 인해 최소 시간이 소요되어야 함
        // 1초 + 2초 + 4초 = 7초 이상
        val elapsedTime = endTime - startTime
        assertTrue("Should take at least 7 seconds due to retries",
            elapsedTime >= 7000)
    }

    @Test
    fun testVariablesMapping() = runBlocking {
        // Given: 봇 등록
        val deviceModel = "Test Android Device"
        val botId = apiClient.registerBot(testDeviceId, deviceModel)
        assertNotNull("Bot registration failed", botId)

        // When: 작업 요청
        val task = apiClient.getTask(botId!!, testLoginId, testImei)

        task?.let {
            // Then: 변수 매핑 검증
            println("=== Variables Mapping Test ===")
            println("User-Agent: ${it.variables.userAgent}")
            println("Cookie Strategy: ${it.variables.cookieStrategy}")
            println("Referer: ${it.variables.referer}")
            println("Sec-Fetch-Site: ${it.variables.secFetchSite}")

            // User-Agent는 비어있지 않아야 함
            assertTrue("User-Agent should not be empty",
                it.variables.userAgent.isNotEmpty())

            // Referer는 유효한 URL 형식이어야 함
            assertTrue("Referer should be valid URL",
                it.variables.referer.startsWith("http"))

            // Sec-Fetch-Site는 유효한 값이어야 함
            assertTrue("Sec-Fetch-Site should be valid",
                it.variables.secFetchSite in listOf("none", "same-site", "same-origin", "cross-site"))

            // 쿠키 전략에 따라 쿠키 존재 여부 확인
            if (it.variables.cookieStrategy == "login") {
                assertNotNull("Login cookies should not be null", it.variables.cookies)
            }
        }
    }
}
