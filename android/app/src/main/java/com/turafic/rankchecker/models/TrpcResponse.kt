package com.turafic.rankchecker.models

import kotlinx.serialization.Serializable

/**
 * tRPC 응답 래퍼
 */
@Serializable
data class TrpcResponse<T>(
    val result: TrpcResult<T>
)

@Serializable
data class TrpcResult<T>(
    val data: T
)

/**
 * 작업 요청 응답
 */
@Serializable
data class GetTaskResponse(
    val success: Boolean,
    val message: String? = null,
    val task: RankCheckTask? = null
)

/**
 * 봇 등록 응답
 */
@Serializable
data class RegisterBotResponse(
    val success: Boolean,
    val botId: Int
)

/**
 * 일반 성공 응답
 */
@Serializable
data class SuccessResponse(
    val success: Boolean
)
