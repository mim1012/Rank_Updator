package com.turafic.rankchecker.network

import android.util.Log
import com.turafic.rankchecker.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.net.URLEncoder

/**
 * Turafic API 클라이언트
 * 서버와의 모든 통신을 담당
 */
class TuraficApiClient(
    private val baseUrl: String = "http://10.0.2.2:5000/trpc"  // Android Emulator에서 localhost
) {
    private val httpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                prettyPrint = true
            })
        }

        install(Logging) {
            logger = object : Logger {
                override fun log(message: String) {
                    Log.v(TAG, message)
                }
            }
            level = LogLevel.INFO
        }

        install(HttpTimeout) {
            requestTimeoutMillis = 30_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 30_000
        }
    }

    /**
     * 1. 봇 등록
     * @param deviceId 디바이스 ID (고유값)
     * @param deviceModel 디바이스 모델명
     * @return 봇 ID
     */
    suspend fun registerBot(deviceId: String, deviceModel: String): Int {
        return retryWithExponentialBackoff {
            Log.d(TAG, "Registering bot: deviceId=$deviceId, model=$deviceModel")

            val response: TrpcResponse<RegisterBotResponse> = httpClient.post("$baseUrl/rankCheck.registerBot") {
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "deviceId" to deviceId,
                    "deviceModel" to deviceModel
                ))
            }.body()

            Log.i(TAG, "Bot registered successfully: botId=${response.result.data.botId}")
            response.result.data.botId
        } ?: throw Exception("Failed to register bot after retries")
    }

    /**
     * 2. 작업 요청
     * @param botId 봇 ID
     * @param loginId Zero API login_id
     * @param imei 디바이스 IMEI
     * @return 순위 체크 작업 (없으면 null)
     */
    suspend fun getTask(botId: Int, loginId: String, imei: String): RankCheckTask? {
        return try {
            val input = URLEncoder.encode(
                """{"botId":$botId,"loginId":"$loginId","imei":"$imei"}""",
                "UTF-8"
            )

            Log.d(TAG, "Requesting task: botId=$botId")

            val response: TrpcResponse<GetTaskResponse> = httpClient.get("$baseUrl/rankCheck.getTask?input=$input").body()

            if (response.result.data.success && response.result.data.task != null) {
                Log.i(TAG, "Task received: ${response.result.data.task.taskId}")
                response.result.data.task
            } else {
                Log.d(TAG, "No tasks available: ${response.result.data.message}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "getTask error", e)
            null
        }
    }

    /**
     * 3. 순위 보고
     * @param taskId 작업 ID
     * @param campaignId 캠페인 ID
     * @param rank 순위 (못 찾으면 -1)
     * @param success 성공 여부
     * @param errorMessage 에러 메시지 (선택)
     */
    suspend fun reportRank(
        taskId: String,
        campaignId: Int,
        rank: Int,
        success: Boolean,
        errorMessage: String? = null
    ) {
        retryWithExponentialBackoff {
            Log.d(TAG, "Reporting rank: campaignId=$campaignId, rank=$rank, success=$success")

            httpClient.post("$baseUrl/rankCheck.reportRank") {
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "taskId" to taskId,
                    "campaignId" to campaignId,
                    "rank" to rank,
                    "timestamp" to kotlinx.datetime.Clock.System.now().toString(),
                    "success" to success,
                    "errorMessage" to errorMessage
                ))
            }

            Log.i(TAG, "Rank reported successfully")
        }
    }

    /**
     * 4. 작업 완료
     * @param taskId 작업 ID
     * @param botId 봇 ID
     */
    suspend fun finishTask(taskId: String, botId: Int) {
        retryWithExponentialBackoff {
            Log.d(TAG, "Finishing task: $taskId")

            httpClient.post("$baseUrl/rankCheck.finishTask") {
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "taskId" to taskId,
                    "botId" to botId
                ))
            }

            Log.i(TAG, "Task finished successfully")
        }
    }

    /**
     * 5. 봇 상태 업데이트
     * @param botId 봇 ID
     * @param status 상태 ("online", "offline", "error")
     */
    suspend fun updateBotStatus(botId: Int, status: String) {
        try {
            Log.d(TAG, "Updating bot status: $status")

            httpClient.post("$baseUrl/rankCheck.updateBotStatus") {
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "botId" to botId,
                    "status" to status
                ))
            }

            Log.i(TAG, "Bot status updated successfully")
        } catch (e: Exception) {
            Log.e(TAG, "updateBotStatus error", e)
        }
    }

    /**
     * 재시도 로직 (지수 백오프)
     * @param maxRetries 최대 재시도 횟수
     * @param initialDelayMillis 초기 지연 시간 (밀리초)
     * @param block 실행할 블록
     * @return 실행 결과 (실패 시 null)
     */
    private suspend fun <T> retryWithExponentialBackoff(
        maxRetries: Int = 3,
        initialDelayMillis: Long = 1000,
        block: suspend () -> T
    ): T? {
        var currentDelay = initialDelayMillis
        repeat(maxRetries) { attempt ->
            try {
                return block()
            } catch (e: Exception) {
                Log.w(TAG, "Retry attempt ${attempt + 1}/$maxRetries failed: ${e.message}")
                if (attempt == maxRetries - 1) {
                    Log.e(TAG, "All retry attempts failed", e)
                    throw e
                }
                delay(currentDelay)
                currentDelay *= 2
            }
        }
        return null
    }

    companion object {
        private const val TAG = "TuraficApiClient"
    }
}
