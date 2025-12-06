/**
 * IP Rotation Module (IfIndex 방식)
 *
 * USB 테더링을 통한 IP 로테이션 기능
 * - 현재 IP 확인
 * - 테더링 어댑터 자동 감지 (IfIndex 사용 - 인코딩 문제 해결)
 * - 테더링 ON/OFF로 IP 변경
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============ 설정 ============
const TETHERING_OFF_DELAY = 3000;  // 3초
const TETHERING_ON_DELAY = 5000;   // 5초
const IP_CHECK_RETRY = 3;
const IP_CHECK_RETRY_DELAY = 2000;

// ============ IP 확인 ============
export async function getCurrentIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json() as { ip: string };
    return data.ip;
  } catch (error) {
    // 백업 API
    try {
      const response = await fetch("https://ifconfig.me/ip");
      return (await response.text()).trim();
    } catch {
      throw new Error("IP 확인 실패: 네트워크 연결 확인 필요");
    }
  }
}

// ============ PowerShell 실행 ============
async function execPowerShell(command: string): Promise<string> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -Command "${command}"`,
    { encoding: "utf8", windowsHide: true }
  );
  return stdout.trim();
}

// ============ 테더링 어댑터 감지 (IfIndex 방식) ============
export interface AdapterInfo {
  ifIndex: number;
  name: string;
  description: string;
}

export async function getTetheringAdapterIndex(): Promise<AdapterInfo | null> {
  try {
    // 방법 1: 테더링 키워드로 검색 (InterfaceIndex 반환)
    const keywordResult = await execPowerShell(
      `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and ($_.InterfaceDescription -like '*NDIS*' -or $_.InterfaceDescription -like '*USB*' -or $_.InterfaceDescription -like '*Android*' -or $_.InterfaceDescription -like '*SAMSUNG*' -or $_.InterfaceDescription -like '*Tethering*') } | Select-Object -First 1 | ForEach-Object { $_.InterfaceIndex.ToString() + '|' + $_.Name + '|' + $_.InterfaceDescription }`
    );

    if (keywordResult && keywordResult.includes('|')) {
      const [ifIndex, name, description] = keywordResult.split('|');
      console.log(`[IPRotation] 테더링 어댑터 감지: IfIndex=${ifIndex}, ${name}`);
      return { ifIndex: parseInt(ifIndex, 10), name, description };
    }

    // 방법 2: 이더넷 N (N > 1) 패턴 검색 - IfIndex로만 비교
    const ethernetResult = await execPowerShell(
      `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Sort-Object InterfaceIndex -Descending | Select-Object -First 1 | ForEach-Object { $_.InterfaceIndex.ToString() + '|' + $_.Name + '|' + $_.InterfaceDescription }`
    );

    if (ethernetResult && ethernetResult.includes('|')) {
      const [ifIndex, name, description] = ethernetResult.split('|');
      // 첫 번째 어댑터가 아닌 경우만 (테더링일 가능성)
      const firstAdapter = await execPowerShell(
        `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Sort-Object InterfaceIndex | Select-Object -First 1 -ExpandProperty InterfaceIndex`
      );
      if (ifIndex !== firstAdapter) {
        console.log(`[IPRotation] 테더링 어댑터 감지: IfIndex=${ifIndex}, ${name}`);
        return { ifIndex: parseInt(ifIndex, 10), name, description };
      }
    }

    // Fallback: 연결된 어댑터 목록 출력
    const listOut = await execPowerShell(
      `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object InterfaceIndex, Name, InterfaceDescription | Format-Table -AutoSize`
    );
    console.log("[IPRotation] 테더링 어댑터를 찾을 수 없음");
    console.log("[IPRotation] 연결된 어댑터 목록:");
    console.log(listOut);
    return null;
  } catch (error: any) {
    console.error(`[IPRotation] 어댑터 감지 실패: ${error.message}`);
    return null;
  }
}

// ============ 테더링 제어 (IfIndex 방식) ============
export async function disableTetheringByIndex(ifIndex: number): Promise<void> {
  try {
    console.log(`[IPRotation] 테더링 비활성화: IfIndex=${ifIndex}`);
    await execPowerShell(`Get-NetAdapter -InterfaceIndex ${ifIndex} | Disable-NetAdapter -Confirm:$false`);
  } catch (error: any) {
    if (!error.message.includes("already")) {
      throw new Error(`테더링 비활성화 실패: ${error.message}`);
    }
  }
}

export async function enableTetheringByIndex(ifIndex: number): Promise<void> {
  try {
    console.log(`[IPRotation] 테더링 활성화: IfIndex=${ifIndex}`);
    await execPowerShell(`Get-NetAdapter -InterfaceIndex ${ifIndex} | Enable-NetAdapter -Confirm:$false`);
  } catch (error: any) {
    if (!error.message.includes("already")) {
      throw new Error(`테더링 활성화 실패: ${error.message}`);
    }
  }
}

// ============ IP 로테이션 (IfIndex 방식) ============
export interface IPRotationResult {
  success: boolean;
  oldIP: string;
  newIP: string;
  error?: string;
}

export async function rotateIP(): Promise<IPRotationResult> {
  // 1. 어댑터 IfIndex 확인
  const adapter = await getTetheringAdapterIndex();
  if (!adapter) {
    return {
      success: false,
      oldIP: "",
      newIP: "",
      error: "테더링 어댑터를 찾을 수 없음",
    };
  }

  // 2. 현재 IP 확인
  let oldIP: string;
  try {
    oldIP = await getCurrentIP();
    console.log(`[IPRotation] 현재 IP: ${oldIP}`);
  } catch (error: any) {
    return {
      success: false,
      oldIP: "",
      newIP: "",
      error: `현재 IP 확인 실패: ${error.message}`,
    };
  }

  // 3. 테더링 비활성화 (IfIndex 사용)
  try {
    await disableTetheringByIndex(adapter.ifIndex);
    console.log(`[IPRotation] ${TETHERING_OFF_DELAY / 1000}초 대기...`);
    await sleep(TETHERING_OFF_DELAY);
  } catch (error: any) {
    return {
      success: false,
      oldIP,
      newIP: "",
      error: `테더링 비활성화 실패: ${error.message}`,
    };
  }

  // 4. 테더링 활성화 (IfIndex 사용)
  try {
    await enableTetheringByIndex(adapter.ifIndex);
    console.log(`[IPRotation] ${TETHERING_ON_DELAY / 1000}초 대기 (재연결)...`);
    await sleep(TETHERING_ON_DELAY);
  } catch (error: any) {
    return {
      success: false,
      oldIP,
      newIP: "",
      error: `테더링 활성화 실패: ${error.message}`,
    };
  }

  // 5. 새 IP 확인 (재시도 포함)
  let newIP = "";
  for (let i = 0; i < IP_CHECK_RETRY; i++) {
    try {
      newIP = await getCurrentIP();
      break;
    } catch {
      console.log(`[IPRotation] IP 확인 재시도 ${i + 1}/${IP_CHECK_RETRY}...`);
      await sleep(IP_CHECK_RETRY_DELAY);
    }
  }

  if (!newIP) {
    return {
      success: false,
      oldIP,
      newIP: "",
      error: "새 IP 확인 실패: 네트워크 재연결 실패",
    };
  }

  // 6. IP 변경 확인
  if (oldIP === newIP) {
    console.log(`[IPRotation] 경고: IP가 변경되지 않음 (${oldIP})`);
    return {
      success: false,
      oldIP,
      newIP,
      error: "IP가 변경되지 않음",
    };
  }

  console.log(`[IPRotation] IP 변경 성공: ${oldIP} → ${newIP}`);
  return {
    success: true,
    oldIP,
    newIP,
  };
}

// ============ 유틸 ============
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
