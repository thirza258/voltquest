#pragma once
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Headers.h>
#include <string>
#include <vector>

namespace vq
{
    // Owned arguments survive suspension. This function performs real native HTTP.
    inline winrt::Windows::Foundation::IAsyncOperation<winrt::hstring> request_json(
        winrt::Windows::Web::Http::HttpClient client,
        winrt::Windows::Web::Http::HttpRequestMessage request)
    {
        using namespace winrt::Windows::Web::Http;
        using namespace winrt::Windows::Storage::Streams;
        auto cancellation = co_await winrt::get_cancellation_token();
        cancellation.enable_propagation();
        auto response = co_await client.SendRequestAsync(request, HttpCompletionOption::ResponseHeadersRead);
        if (!response.IsSuccessStatusCode())
        {
            auto message = L"HTTP " + std::to_wstring(static_cast<unsigned>(response.StatusCode()))
                + L". Previous data retained.";
            throw winrt::hresult_invalid_argument(winrt::hstring{ message });
        }
        auto content = response.Content();
        if (!content || !content.Headers().ContentType()
            || content.Headers().ContentType().MediaType() != L"application/json")
            throw winrt::hresult_invalid_argument(L"Expected application/json.");
        auto length = content.Headers().ContentLength();
        if (length && length.Value() > 64 * 1024)
            throw winrt::hresult_invalid_argument(L"Response exceeds 64 KiB.");
        auto stream = co_await content.ReadAsInputStreamAsync();
        DataReader reader{ stream };
        reader.InputStreamOptions(InputStreamOptions::Partial);
        std::string bytes;
        for (;;)
        {
            auto count = co_await reader.LoadAsync(4096);
            if (!count) break;
            if (bytes.size() + count > 64 * 1024)
                throw winrt::hresult_invalid_argument(L"Response exceeds 64 KiB.");
            std::vector<std::uint8_t> chunk(count);
            reader.ReadBytes(chunk);
            bytes.append(reinterpret_cast<char const*>(chunk.data()), chunk.size());
        }
        reader.Close();
        response.Close();
        if (cancellation()) throw winrt::hresult_canceled();
        // Convert once: a UTF-8 character can span two network chunks.
        co_return winrt::to_hstring(bytes);
    }
}
