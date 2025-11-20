using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Diagnostics;

class TestCSharpHttp
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("\n=== C# HttpClient Test ===\n");
        Console.WriteLine("============================================================");
        Console.WriteLine($"\n.NET Version: {Environment.Version}");
        Console.WriteLine("\nTesting HttpClient with different configurations:\n");

        var testUrl = "https://msearch.shopping.naver.com/search/all?query=%EC%9E%A5%EB%82%9C%EA%B0%90&pagingIndex=1";

        var stopwatch = Stopwatch.StartNew();

        // Test 1: Default HttpClient
        var result1 = await TestDefaultHttpClient(testUrl);

        // Test 2: HttpClient with HTTP/2
        var result2 = await TestHttp2Client(testUrl);

        // Test 3: HttpClient with custom handler
        var result3 = await TestCustomHandler(testUrl);

        stopwatch.Stop();

        Console.WriteLine("\n============================================================");
        Console.WriteLine("\n=== Test Results ===\n");

        Console.WriteLine($"  Default HttpClient    : {result1}");
        Console.WriteLine($"  HTTP/2 HttpClient     : {result2}");
        Console.WriteLine($"  Custom Handler Client : {result3}");

        Console.WriteLine($"\nDuration: {stopwatch.Elapsed.TotalSeconds:F2}s");

        var successCount = 0;
        if (result1.Contains("200")) successCount++;
        if (result2.Contains("200")) successCount++;
        if (result3.Contains("200")) successCount++;

        Console.WriteLine($"Success (HTTP 200): {successCount}/3");

        if (successCount > 0)
        {
            Console.WriteLine("\n=== SUCCESS: C# bypassed bot detection! ===");
        }
        else
        {
            Console.WriteLine("\n=== FAILED: All C# HttpClient configurations detected as bots ===");
            Console.WriteLine("\nConclusion:");
            Console.WriteLine("  - C# also fails with TLS fingerprinting");
            Console.WriteLine("  - Server-based HTTP packets are impossible regardless of language");
        }

        Console.WriteLine("\nTest complete.");
    }

    static async Task<string> TestDefaultHttpClient(string url)
    {
        try
        {
            Console.WriteLine("[1/3] Default HttpClient test...");

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("user-agent",
                "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36");
            client.DefaultRequestHeaders.Add("upgrade-insecure-requests", "1");
            client.DefaultRequestHeaders.Add("accept-language", "ko-KR,ko;q=0.9");

            var response = await client.GetAsync(url);
            var status = (int)response.StatusCode;
            var content = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"   OK HTTP {status} ({content.Length} bytes)");
            return $"HTTP {status}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"   ERROR: {ex.Message}");
            return "ERROR";
        }
    }

    static async Task<string> TestHttp2Client(string url)
    {
        try
        {
            Console.WriteLine("[2/3] HTTP/2 HttpClient test...");

            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
            };

            using var client = new HttpClient(handler);
            client.DefaultRequestVersion = new Version(2, 0);
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("user-agent",
                "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36");
            client.DefaultRequestHeaders.Add("upgrade-insecure-requests", "1");
            client.DefaultRequestHeaders.Add("accept-language", "ko-KR,ko;q=0.9");

            var response = await client.GetAsync(url);
            var status = (int)response.StatusCode;
            var content = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"   OK HTTP {status} ({content.Length} bytes)");
            return $"HTTP {status}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"   ERROR: {ex.Message}");
            return "ERROR";
        }
    }

    static async Task<string> TestCustomHandler(string url)
    {
        try
        {
            Console.WriteLine("[3/3] Custom Handler HttpClient test...");

            var handler = new SocketsHttpHandler
            {
                PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                EnableMultipleHttp2Connections = true
            };

            using var client = new HttpClient(handler);
            client.DefaultRequestVersion = new Version(2, 0);
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("user-agent",
                "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36");
            client.DefaultRequestHeaders.Add("upgrade-insecure-requests", "1");
            client.DefaultRequestHeaders.Add("accept-language", "ko-KR,ko;q=0.9");

            var response = await client.GetAsync(url);
            var status = (int)response.StatusCode;
            var content = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"   OK HTTP {status} ({content.Length} bytes)");
            return $"HTTP {status}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"   ERROR: {ex.Message}");
            return "ERROR";
        }
    }
}
