"""
Python HTTP 라이브러리 테스트

requests, httpx, urllib3를 테스트합니다.
"""

import time
import sys

# 테스트 URL
test_url = "https://msearch.shopping.naver.com/search/all?query=%EC%9E%A5%EB%82%9C%EA%B0%90&pagingIndex=1"

headers = {
    "user-agent": "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
    "upgrade-insecure-requests": "1",
    "accept-language": "ko-KR,ko;q=0.9",
}

def test_requests():
    """requests 라이브러리 테스트"""
    try:
        import requests
        print("[1/3] requests test...")

        response = requests.get(test_url, headers=headers, timeout=10)
        status = response.status_code

        print(f"   OK HTTP {status} ({len(response.text)} bytes)")
        return status
    except ImportError:
        print("   WARN requests not installed")
        return None
    except Exception as e:
        print(f"   ERROR: {e}")
        return 0

def test_httpx():
    """httpx 라이브러리 테스트 (HTTP/2 지원)"""
    try:
        import httpx
        print("[2/3] httpx test (HTTP/2)...")

        with httpx.Client(http2=True) as client:
            response = client.get(test_url, headers=headers, timeout=10)
            status = response.status_code

            print(f"   OK HTTP {status} ({len(response.text)} bytes)")
            return status
    except ImportError:
        print("   WARN httpx not installed")
        return None
    except Exception as e:
        print(f"   ERROR: {e}")
        return 0

def test_urllib3():
    """urllib3 라이브러리 테스트"""
    try:
        import urllib3
        print("[3/3] urllib3 test...")

        http = urllib3.PoolManager()
        response = http.request('GET', test_url, headers=headers, timeout=10)
        status = response.status

        print(f"   OK HTTP {status} ({len(response.data)} bytes)")
        return status
    except ImportError:
        print("   WARN urllib3 not installed")
        return None
    except Exception as e:
        print(f"   ERROR: {e}")
        return 0

def main():
    print("\n=== Python HTTP Libraries Test ===\n")
    print("="*60)
    print("\nPython version:", sys.version)
    print("\nTesting 3 libraries:\n")

    start_time = time.time()

    results = {
        "requests": test_requests(),
        "httpx": test_httpx(),
        "urllib3": test_urllib3(),
    }

    duration = time.time() - start_time

    print("\n" + "="*60)
    print("\n=== Test Results ===\n")

    for lib, status in results.items():
        if status is None:
            status_text = "not installed"
        elif status == 200:
            status_text = f"SUCCESS HTTP {status}"
        elif status == 0:
            status_text = "ERROR"
        else:
            status_text = f"FAILED HTTP {status}"

        print(f"  {lib.ljust(15)}: {status_text}")

    print(f"\nDuration: {duration:.2f}s")

    success_count = sum(1 for s in results.values() if s == 200)
    print(f"Success (HTTP 200): {success_count}/3")

    if success_count > 0:
        print("\n=== SUCCESS: Python bypassed bot detection! ===")
        print("\nSuccessful libraries:")
        for lib, status in results.items():
            if status == 200:
                print(f"  - {lib}")
    else:
        print("\n=== FAILED: All Python libraries detected as bots ===")
        print("\nConclusion:")
        print("  - Python also fails with TLS fingerprinting (same as Node.js)")
        print("  - Server-based HTTP packets are impossible regardless of language")

    print("\nTest complete.")

if __name__ == "__main__":
    main()
