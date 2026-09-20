import apiClient from './native/ApiClient.h?raw'
import apiServer from './native/api_server.py?raw'
import fetchDemo from './native/fetch-demo.mjs?raw'
import apiTests from './native/test_api_server.py?raw'

export const apiFiles = { 'ApiClient.h': apiClient, 'api_server.py': apiServer, 'test_api_server.py': apiTests, 'fetch-demo.mjs': fetchDemo }

export const apiInstructions = `## Local API and fetch comparison

Start the fixture on the same Windows machine as the native app:

    py -3 api_server.py

It binds only 127.0.0.1:8766, starts with one task and keeps data in memory.
Restart to reset it; stop with Ctrl+C. No account, API key or external service is needed.
Keep the server running while you run the WinUI lab. If you change --port, also
change the fixed URL in MainWindow.xaml.cpp. Put ApiClient.h beside that file.
The native app uses Windows.Web.Http.HttpClient, not JavaScript fetch or .NET HttpClient.

Optional comparison with Node 18+ in another terminal:

    node fetch-demo.mjs

Expected on a fresh server: GET: 1 task(s), POST: 2 Created with fetch,
GET readback: 2 task(s). This JavaScript file is a terminal companion, not C++.
With Python 3 and Node available, run the fixture's twelve HTTP regression checks:

    py -3 -m unittest -v test_api_server.py

The tests start their own disposable server on a free loopback port.
The fixture has no browser CORS support; use Node for this comparison. Native C++
requests are not governed by browser CORS. HTTP is intentional for this local
loopback exercise. Use HTTPS with normal certificate validation for remote APIs.
The packaged full-trust WinUI desktop template is not a UWP AppContainer sample;
do not blindly apply UWP loopback exemption instructions to it.

GET /tasks -> 200 {"tasks":[{"id":1,"title":"Learn native HTTP"}]}
POST /tasks, Content-Type: application/json, {"title":"My task"}
  -> 201 {"id":2,"title":"My task"}; a later GET reads the actual new task.
The native request sets Accept: application/json and X-VoltQuest-Lab: winui.
POST uses JsonObject.Stringify and HttpStringContent with UTF-8 application/json.
The GET selector also exposes 404, 401, 503, invalid JSON/schema, wrong media type,
oversized response and a 15-second slow response. POST always targets /tasks.

The C++ client disables redirects, accepts JSON bodies up to 64 KiB, validates all
task objects before updating the list, and runs one operation at a time. A UI
timer requests cancellation after ten seconds; it is not a precise hard deadline.
Cancel/close propagate cancellation to pending WinRT operations and suppress UI
updates. Cancellation does not undo an already accepted POST. Fetch tasks before
retrying an uncertain write; this fixture has no idempotency-key implementation.
There are no automatic retries or real bearer tokens. Authentication and remote
service integration are explained as extensions, not implemented sign-in features.

The fixture and Node companion can run on macOS/Linux. Those results do not verify
native Windows HTTP transport, WinUI threading, timeout/cancellation or packaging.
`

export const apiSample = {
  body: `<StackPanel x:Name="RequestPanel" Spacing="12">
<ComboBox x:Name="EndpointChoice" Header="GET endpoint" SelectedIndex="0">
  <ComboBoxItem Content="Tasks" Tag="/tasks" />
  <ComboBoxItem Content="404 missing" Tag="/missing" />
  <ComboBoxItem Content="401 unauthorized" Tag="/unauthorized" />
  <ComboBoxItem Content="503 server error" Tag="/server-error" />
  <ComboBoxItem Content="Invalid JSON" Tag="/invalid-json" />
  <ComboBoxItem Content="Invalid task schema" Tag="/invalid-schema" />
  <ComboBoxItem Content="Wrong media type" Tag="/wrong-type" />
  <ComboBoxItem Content="Oversized body" Tag="/oversized" />
  <ComboBoxItem Content="Slow response (15 seconds)" Tag="/slow" />
</ComboBox>
<Button Content="Fetch tasks (GET)" Click="Fetch_Click" />
<TextBox x:Name="TitleInput" Header="Task title to POST" />
<Button Content="Create task (POST)" Click="Post_Click" />
</StackPanel>
<Button Content="Cancel request" Click="Cancel_Click" />
<ListView x:Name="TaskList" Height="240" AutomationProperties.Name="API tasks" />`,
  headerIncludes: '#include <winrt/Windows.Web.Http.h>\n#include <winrt/Microsoft.UI.Dispatching.h>',
  includes: '#include "ApiClient.h"\n#include <winrt/Windows.Web.Http.Filters.h>\n#include <winrt/Windows.Data.Json.h>\n#include <cmath>',
  fields: `wf::Collections::IObservableVector<wf::IInspectable> m_tasks = winrt::single_threaded_observable_vector<wf::IInspectable>();
        Windows::Web::Http::HttpClient m_http{ nullptr };
        wf::IAsyncOperation<winrt::hstring> m_pending{ nullptr };
        Microsoft::UI::Dispatching::DispatcherQueueTimer m_timeout{ nullptr };
        bool m_busy = false, m_canceled = false, m_timedOut = false;`,
  declarations: `void Fetch_Click(wf::IInspectable const&, mux::RoutedEventArgs const&);
        void Post_Click(wf::IInspectable const&, mux::RoutedEventArgs const&);
        void Cancel_Click(wf::IInspectable const&, mux::RoutedEventArgs const&);
        winrt::fire_and_forget RequestAsync(bool post);`,
  init: `    TaskList().ItemsSource(m_tasks);
    Windows::Web::Http::Filters::HttpBaseProtocolFilter filter;
    filter.AllowAutoRedirect(false);
    m_http = Windows::Web::Http::HttpClient{ filter };
    m_timeout = DispatcherQueue().CreateTimer();
    m_timeout.IsRepeating(false);
    m_timeout.Interval(std::chrono::seconds{10});
    m_timeout.Tick([weak = get_weak()](auto const&, auto const&)
    {
        if (auto self = weak.get())
        {
            if (self->m_busy && self->m_pending)
            {
                self->m_timedOut = true;
                self->m_pending.Cancel();
            }
        }
    });`,
  closeMethod: `void MainWindow::Window_Closed(wf::IInspectable const&, mux::WindowEventArgs const&)
{
    m_closed = true;
    m_timeout.Stop();
    if (m_pending) m_pending.Cancel();
}
`,
  methods: `namespace
{
    winrt::hstring task_label(Windows::Data::Json::JsonObject const& task)
    {
        auto id = task.GetNamedNumber(L"id");
        auto title = task.GetNamedString(L"title");
        auto text = std::wstring{ title.c_str(), title.size() };
        if (!std::isfinite(id) || id < 1 || id > 1000000 || std::floor(id) != id
            || !vq::title_error(text).empty() || vq::clean_title(text) != text)
            throw winrt::hresult_invalid_argument(L"Invalid task response schema.");
        return winrt::hstring{ std::to_wstring(static_cast<int>(id)) + L": " + text };
    }
}

void MainWindow::Fetch_Click(wf::IInspectable const&, mux::RoutedEventArgs const&)
{
    RequestAsync(false);
}

void MainWindow::Post_Click(wf::IInspectable const&, mux::RoutedEventArgs const&)
{
    RequestAsync(true);
}

void MainWindow::Cancel_Click(wf::IInspectable const&, mux::RoutedEventArgs const&)
{
    if (!m_busy || !m_pending || m_closed) return;
    m_canceled = true;
    m_pending.Cancel();
    StatusText().Text(L"Cancellation requested. A POST may already have reached the server.");
}

winrt::fire_and_forget MainWindow::RequestAsync(bool post)
{
    auto lifetime = get_strong();
    if (m_busy || m_closed) co_return;
    using namespace Windows::Web::Http;
    using namespace Windows::Data::Json;
    m_busy = true;
    m_canceled = m_timedOut = false;
    RequestPanel().IsEnabled(false);
    try
    {
        auto selected = EndpointChoice().SelectedItem().as<mux::Controls::ComboBoxItem>();
        auto path = post ? winrt::hstring{ L"/tasks" } : winrt::unbox_value<winrt::hstring>(selected.Tag());
        wf::Uri uri{ winrt::hstring{ L"http://127.0.0.1:8766" + std::wstring{ path.c_str(), path.size() } } };
        HttpRequestMessage request{ post ? HttpMethod::Post() : HttpMethod::Get(), uri };
        request.Headers().Append(L"Accept", L"application/json");
        request.Headers().Append(L"X-VoltQuest-Lab", L"winui");
        if (post)
        {
            auto raw = TitleInput().Text();
            auto title = vq::clean_title(std::wstring_view{ raw.c_str(), raw.size() });
            auto error = vq::title_error(title);
            if (!error.empty()) throw winrt::hresult_invalid_argument(winrt::hstring{ error });
            JsonObject body;
            body.Insert(L"title", JsonValue::CreateStringValue(winrt::hstring{ title }));
            request.Content(HttpStringContent{ body.Stringify(), Windows::Storage::Streams::UnicodeEncoding::Utf8, L"application/json" });
        }
        StatusText().Text(post ? L"POST pending..." : L"GET pending...");
        m_pending = vq::request_json(m_http, request);
        m_timeout.Start();
        auto text = co_await m_pending; // WinRT await resumes in this UI apartment.
        if (m_canceled || m_timedOut) throw winrt::hresult_canceled();
        JsonObject document;
        if (!JsonObject::TryParse(text, document)) throw winrt::hresult_invalid_argument(L"Invalid JSON response.");
        if (post)
        {
            auto label = task_label(document);
            if (!m_closed)
            {
                if (m_tasks.Size() < vq::max_tasks) m_tasks.Append(winrt::box_value(label));
                TitleInput().Text(L"");
                StatusText().Text(L"POST succeeded. Fetch tasks to verify server state.");
            }
        }
        else
        {
            auto tasks = document.GetNamedArray(L"tasks");
            if (tasks.Size() > vq::max_tasks) throw winrt::hresult_invalid_argument(L"Too many tasks in response.");
            std::vector<wf::IInspectable> candidate;
            for (auto const& item : tasks) candidate.push_back(winrt::box_value(task_label(item.GetObject())));
            if (!m_closed)
            {
                m_tasks.ReplaceAll(candidate);
                StatusText().Text(L"GET succeeded. Validated server tasks loaded.");
            }
        }
    }
    catch (winrt::hresult_error const& error)
    {
        if (!m_closed)
        {
            if (m_timedOut) StatusText().Text(L"Request timed out. Data retained; check server state before retrying POST.");
            else if (m_canceled) StatusText().Text(L"Request canceled. Data retained; a sent POST is not rolled back.");
            else StatusText().Text(error.message());
        }
    }
    m_timeout.Stop();
    m_pending = nullptr;
    m_busy = false;
    if (!m_closed) RequestPanel().IsEnabled(true);
}
`,
}
