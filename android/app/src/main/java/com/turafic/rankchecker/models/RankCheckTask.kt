package com.turafic.rankchecker.models

import kotlinx.serialization.Serializable

/**
 * 순위 체크 작업
 * 서버로부터 받은 작업 정보
 */
@Serializable
data class RankCheckTask(
    val taskId: String,
    val campaignId: Int,
    val keyword: String,
    val productId: String,
    val platform: String,
    val variables: TaskVariables
)

/**
 * 작업 변수
 * HTTP 헤더 및 쿠키 설정
 */
@Serializable
data class TaskVariables(
    val userAgent: String,
    val cookieStrategy: String,  // "login" or "nologin"
    val referer: String,
    val secFetchSite: String,     // "none", "same-site", "same-origin"
    val cookies: Map<String, String>? = null
)

/**
 * 상품 정보
 * JavaScript로 추출한 상품 데이터
 */
@Serializable
data class Product(
    val index: Int,
    val mid1: String
)
