import taskRules from './native/TaskRules.h?raw'
import taskRulesTest from './native/TaskRules.test.cpp?raw'
import { apiFiles, apiInstructions, apiSample } from './apiSample.js'

const input = '<TextBox x:Name="TitleInput" Header="Task title" />'
const status = '<TextBlock x:Name="StatusText" Text="Ready" TextWrapping="Wrap" AutomationProperties.LiveSetting="Polite" />'
const addButton = '<Button Content="Add task" Click="Action_Click" />'
const list = '<ListView x:Name="TaskList" Height="240" SelectionMode="Single" AutomationProperties.Name="Tasks" />'
const actionSignature = 'wf::IInspectable const&, mux::RoutedEventArgs const&'
const action = body => `void MainWindow::Action_Click(${actionSignature})\n{\n${body}\n}\n`
const validate = `    auto input = TitleInput().Text();
    auto title = vq::clean_title(std::wstring_view{ input.c_str(), input.size() });
    auto error = vq::title_error(title);
    if (!error.empty()) { StatusText().Text(winrt::hstring{ error }); return; }
`
const collectionField = 'wf::Collections::IObservableVector<wf::IInspectable> m_tasks = winrt::single_threaded_observable_vector<wf::IInspectable>();'
const collectionInit = '    TaskList().ItemsSource(m_tasks);'
const closeMethod = `void MainWindow::Window_Closed(wf::IInspectable const&, mux::WindowEventArgs const&)
{
    m_closed = true;
}
`

function spec(id) {
  switch (id) {
    case 'winui-start': return {
      body: '<Button Content="Say hello" Click="Action_Click" />',
      methods: action('    StatusText().Text(L"Hello from C++ and WinUI 3");'),
    }
    case 'winui-layout':
    case 'winui-events':
    case 'winui-testing': return {
      body: `${input}\n${addButton}`,
      fields: 'std::size_t m_count = 0;',
      methods: action(`${validate}    ++m_count;
    StatusText().Text(winrt::hstring{ L"Accepted " + std::to_wstring(m_count) + L": " + title });
    TitleInput().Text(L"");
    TitleInput().Focus(mux::FocusState::Programmatic);`),
    }
    case 'winui-binding': return {
      body: `${input}\n<TextBlock Text="{Binding Text, ElementName=TitleInput, Mode=OneWay}" TextWrapping="Wrap" />\n${addButton}\n${list}`,
      fields: collectionField, init: collectionInit,
      methods: action(`${validate}    if (m_tasks.Size() >= vq::max_tasks) { StatusText().Text(L"The 100-task limit is reached."); return; }
    m_tasks.Append(winrt::box_value(winrt::hstring{ title }));
    TitleInput().Text(L"");
    StatusText().Text(L"Task added to the observable collection.");`),
    }
    case 'winui-navigation': return {
      body: `<NavigationView x:Name="Navigation" IsSettingsVisible="False" IsBackButtonVisible="Collapsed" SelectionChanged="Navigation_SelectionChanged">
  <NavigationView.MenuItems>
    <NavigationViewItem Content="Tasks" Tag="tasks" />
    <NavigationViewItem Content="About" Tag="about" />
  </NavigationView.MenuItems>
  <TextBlock x:Name="DestinationText" Text="Select a destination" Margin="16" TextWrapping="Wrap" />
</NavigationView>`,
      declarations: 'void Navigation_SelectionChanged(mux::Controls::NavigationView const&, mux::Controls::NavigationViewSelectionChangedEventArgs const&);',
      fields: 'int m_visits = 0;',
      methods: `void MainWindow::Navigation_SelectionChanged(mux::Controls::NavigationView const&, mux::Controls::NavigationViewSelectionChangedEventArgs const& args)
{
    auto item = args.SelectedItem().try_as<mux::Controls::NavigationViewItem>();
    if (!item) return;
    auto key = winrt::unbox_value<winrt::hstring>(item.Tag());
    if (key == L"tasks")
        DestinationText().Text(winrt::hstring{ L"Tasks visits this session: " + std::to_wstring(++m_visits) });
    else if (key == L"about")
        DestinationText().Text(L"A WinUI navigation shell. This sample has no Frame history.");
}
`,
    }
    case 'winui-dialogs': return {
      body: `${input}\n<Button Content="Clear draft" Click="Action_Click" />`,
      async: true, fields: 'bool m_busy = false;',
      methods: `winrt::fire_and_forget MainWindow::Action_Click(${actionSignature})
{
    auto lifetime = get_strong();
    if (m_busy || m_closed) co_return;
    m_busy = true;
    try
    {
        mux::Controls::ContentDialog dialog;
        dialog.XamlRoot(RootPanel().XamlRoot());
        dialog.Title(winrt::box_value(L"Clear this draft?"));
        dialog.Content(winrt::box_value(L"The text in the task field will be discarded."));
        dialog.PrimaryButtonText(L"Clear draft");
        dialog.CloseButtonText(L"Cancel");
        dialog.DefaultButton(mux::Controls::ContentDialogButton::Close);
        auto result = co_await dialog.ShowAsync();
        if (!m_closed)
        {
            if (result == mux::Controls::ContentDialogResult::Primary)
            {
                TitleInput().Text(L"");
                StatusText().Text(L"Draft cleared.");
            }
            else StatusText().Text(L"Canceled. Draft retained.");
        }
    }
    catch (winrt::hresult_error const& error)
    {
        if (!m_closed) StatusText().Text(error.message());
    }
    m_busy = false;
}
`,
    }
    case 'winui-async': return {
      body: `${input}\n<Button Content="Start preview" Click="Action_Click" />\n<Button Content="Cancel preview" Click="Cancel_Click" />`,
      async: true, fields: 'std::uint64_t m_generation = 0;',
      declarations: `void Cancel_Click(${actionSignature});`,
      methods: `winrt::fire_and_forget MainWindow::Action_Click(${actionSignature})
{
    auto lifetime = get_strong();
    if (m_closed) co_return;
    auto request = ++m_generation;
    auto title = TitleInput().Text();
    winrt::apartment_context ui;
    StatusText().Text(L"Preview pending. You can edit or move the window.");
    try
    {
        co_await winrt::resume_after(std::chrono::seconds{1});
        co_await ui;
        if (m_closed || request != m_generation) co_return;
        StatusText().Text(winrt::hstring{ L"Preview of captured input: " + std::wstring{title.c_str(), title.size()} });
    }
    catch (winrt::hresult_error const&)
    {
        // The UI apartment can be unavailable during shutdown. Do not touch controls here.
    }
}

void MainWindow::Cancel_Click(${actionSignature})
{
    ++m_generation; // Invalidates results; it does not stop existing timers.
    StatusText().Text(L"Preview canceled. Old results will be ignored.");
}
`,
    }
    case 'winui-files': return {
      body: '<Button Content="Open UTF-8 text file" Click="Action_Click" />\n<TextBlock x:Name="DocumentText" Text="No document loaded" TextWrapping="Wrap" />',
      async: true, fields: 'bool m_busy = false;',
      includes: '#include <microsoft.ui.xaml.window.h>\n#include <ShObjIdl.h>\n#include <winrt/Windows.Storage.Pickers.h>\n#include "TextFile.h"',
      methods: `winrt::fire_and_forget MainWindow::Action_Click(${actionSignature})
{
    auto lifetime = get_strong();
    if (m_busy || m_closed) co_return;
    m_busy = true;
    try
    {
        Windows::Storage::Pickers::FileOpenPicker picker;
        HWND hwnd{};
        winrt::check_hresult(this->as<::IWindowNative>()->get_WindowHandle(&hwnd));
        winrt::check_hresult(picker.as<::IInitializeWithWindow>()->Initialize(hwnd));
        picker.FileTypeFilter().Append(L".txt");
        auto file = co_await picker.PickSingleFileAsync();
        if (!m_closed && file)
        {
            auto text = co_await vq::read_text(file);
            if (!m_closed)
            {
                DocumentText().Text(text);
                StatusText().Text(L"UTF-8 document loaded.");
            }
        }
        else if (!m_closed) StatusText().Text(L"Canceled. Previous document retained.");
    }
    catch (winrt::hresult_error const& error)
    {
        if (!m_closed) StatusText().Text(error.message());
    }
    m_busy = false;
}
`,
    }
    case 'winui-accessibility': return {
      body: `${input}\n${addButton}\n<Button Content="Toggle light or dark theme" Click="Theme_Click" />`,
      fields: 'bool m_dark = false;',
      declarations: `void Theme_Click(${actionSignature});`,
      methods: action(`${validate}    StatusText().Text(winrt::hstring{ L"Accepted: " + title });
    TitleInput().Text(L"");
    TitleInput().Focus(mux::FocusState::Programmatic);`) + `
void MainWindow::Theme_Click(${actionSignature})
{
    m_dark = !m_dark;
    RootPanel().RequestedTheme(m_dark ? mux::ElementTheme::Dark : mux::ElementTheme::Light);
}
`,
    }
    case 'winui-packaging': return {
      body: '<TextBlock Text="Build a packaged Release app, then launch it outside Visual Studio." TextWrapping="Wrap" />\n<Button Content="Show release checks" Click="Action_Click" />',
      methods: action('    StatusText().Text(L"Check installed launch, matching architecture, runtime availability and update behavior. See RELEASE-CHECKLIST.md.");'),
    }
    case 'winui-capstone': return capstone()
    case 'winui-api': return apiSample
    default: throw new Error(`Unknown WinUI sample: ${id}`)
  }
}

function capstone() {
  return {
    body: `<StackPanel x:Name="EditingPanel" Spacing="12">
${input}
${addButton}
${list}
<Button Content="Remove selected task" Click="Remove_Click" />
<Button Content="Save tasks" Click="Save_Click" />
<Button Content="Load saved tasks" Click="Load_Click" />
</StackPanel>`,
    fields: `${collectionField}\n        bool m_busy = false;`, init: collectionInit,
    declarations: `void Remove_Click(${actionSignature});
        winrt::fire_and_forget Save_Click(${actionSignature});
        winrt::fire_and_forget Load_Click(${actionSignature});
        void SetBusy(bool busy);`,
    includes: '#include <winrt/Windows.Data.Json.h>\n#include <winrt/Windows.Storage.h>\n#include "TextFile.h"',
    methods: action(`    if (m_busy || m_closed) return;
${validate}    if (m_tasks.Size() >= vq::max_tasks) { StatusText().Text(L"The 100-task limit is reached."); return; }
    m_tasks.Append(winrt::box_value(winrt::hstring{ title }));
    TitleInput().Text(L"");
    StatusText().Text(L"Task added. Unsaved changes.");
    TitleInput().Focus(mux::FocusState::Programmatic);`) + `
void MainWindow::Remove_Click(${actionSignature})
{
    if (m_busy || m_closed) return;
    auto index = TaskList().SelectedIndex();
    if (!vq::valid_selection(index, m_tasks.Size()))
    {
        StatusText().Text(L"Select a task first.");
        return;
    }
    m_tasks.RemoveAt(static_cast<std::uint32_t>(index));
    StatusText().Text(L"Task removed. Unsaved changes.");
}

void MainWindow::SetBusy(bool busy)
{
    m_busy = busy;
    if (!m_closed) EditingPanel().IsEnabled(!busy);
}

winrt::fire_and_forget MainWindow::Save_Click(${actionSignature})
{
    auto lifetime = get_strong();
    if (m_busy || m_closed) co_return;
    SetBusy(true);
    try
    {
        Windows::Data::Json::JsonArray tasks;
        for (auto const& item : m_tasks)
            tasks.Append(Windows::Data::Json::JsonValue::CreateStringValue(winrt::unbox_value<winrt::hstring>(item)));
        Windows::Data::Json::JsonObject document;
        document.Insert(L"version", Windows::Data::Json::JsonValue::CreateNumberValue(1));
        document.Insert(L"tasks", tasks);
        auto snapshot = document.Stringify();
        auto folder = Windows::Storage::ApplicationData::Current().LocalFolder();
        StatusText().Text(L"Saving...");
        auto file = co_await folder.CreateFileAsync(L"voltquest-tasks-v1.json", Windows::Storage::CreationCollisionOption::ReplaceExisting);
        co_await Windows::Storage::FileIO::WriteTextAsync(file, snapshot, Windows::Storage::Streams::UnicodeEncoding::Utf8);
        if (!m_closed) StatusText().Text(L"Saved tasks to the app local folder.");
    }
    catch (winrt::hresult_error const& error)
    {
        if (!m_closed) StatusText().Text(winrt::hstring{ L"Save failed; tasks retained in memory. " + std::wstring{error.message().c_str()} });
    }
    SetBusy(false);
}

winrt::fire_and_forget MainWindow::Load_Click(${actionSignature})
{
    auto lifetime = get_strong();
    if (m_busy || m_closed) co_return;
    SetBusy(true);
    try
    {
        mux::Controls::ContentDialog dialog;
        dialog.XamlRoot(RootPanel().XamlRoot());
        dialog.Title(winrt::box_value(L"Replace the current task list?"));
        dialog.Content(winrt::box_value(L"Load the saved list from this app's local folder. Unsaved tasks will be replaced after validation."));
        dialog.PrimaryButtonText(L"Load saved");
        dialog.CloseButtonText(L"Cancel");
        dialog.DefaultButton(mux::Controls::ContentDialogButton::Close);
        auto decision = co_await dialog.ShowAsync();
        if (m_closed) { SetBusy(false); co_return; }
        if (decision != mux::Controls::ContentDialogResult::Primary)
        {
            StatusText().Text(L"Canceled. Current tasks retained.");
            SetBusy(false);
            co_return;
        }
        auto folder = Windows::Storage::ApplicationData::Current().LocalFolder();
        auto file = co_await folder.GetFileAsync(L"voltquest-tasks-v1.json");
        auto text = co_await vq::read_text(file);
        Windows::Data::Json::JsonObject document;
        if (!Windows::Data::Json::JsonObject::TryParse(text, document) || document.GetNamedNumber(L"version") != 1)
            throw winrt::hresult_invalid_argument(L"Unsupported task document.");
        auto tasks = document.GetNamedArray(L"tasks");
        if (tasks.Size() > vq::max_tasks) throw winrt::hresult_invalid_argument(L"Too many tasks.");
        std::vector<wf::IInspectable> candidate;
        for (auto const& item : tasks)
        {
            auto title = item.GetString(); // Reject non-string JSON values.
            auto original = std::wstring{title.c_str(), title.size()};
            auto cleaned = vq::clean_title(original);
            if (!vq::title_error(cleaned).empty() || cleaned != original)
                throw winrt::hresult_invalid_argument(L"Invalid saved task title.");
            candidate.push_back(winrt::box_value(title));
        }
        if (!m_closed)
        {
            m_tasks.ReplaceAll(candidate);
            StatusText().Text(L"Loaded saved tasks.");
        }
    }
    catch (winrt::hresult_error const& error)
    {
        if (!m_closed) StatusText().Text(winrt::hstring{ L"Load failed; current tasks retained. " + std::wstring{error.message().c_str()} });
    }
    SetBusy(false);
}
`,
  }
}

const textFile = `#pragma once
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.Streams.h>

namespace vq
{
    inline winrt::Windows::Foundation::IAsyncOperation<winrt::hstring>
    read_text(winrt::Windows::Storage::StorageFile file) // Owned across suspension.
    {
        using namespace winrt::Windows::Storage;
        using namespace winrt::Windows::Storage::Streams;
        auto stream = co_await file.OpenAsync(FileAccessMode::Read);
        auto size = stream.Size();
        if (size > 64 * 1024) throw winrt::hresult_invalid_argument(L"File exceeds 64 KiB.");
        DataReader reader{ stream.GetInputStreamAt(0) };
        reader.UnicodeEncoding(UnicodeEncoding::Utf8);
        auto loaded = co_await reader.LoadAsync(static_cast<std::uint32_t>(size));
        if (loaded != size || stream.Size() != size)
            throw winrt::hresult_invalid_argument(L"File changed during the read. Try again.");
        auto text = loaded ? reader.ReadString(loaded) : winrt::hstring{};
        reader.Close();
        stream.Close();
        // Accept an optional UTF-8 BOM as a decoded U+FEFF.
        if (!text.empty() && text[0] == 0xfeff)
            text = winrt::hstring{ text.c_str() + 1, text.size() - 1 };
        co_return text;
    }
}
`

export function getWinuiFiles(course) {
  const sample = spec(course.id)
  const files = {
    'MainWindow.xaml': `<Window
    x:Class="VoltQuestDesktop.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="VoltQuestDesktop" Closed="Window_Closed">
  <ScrollViewer HorizontalScrollBarVisibility="Disabled" VerticalScrollBarVisibility="Auto">
    <StackPanel x:Name="RootPanel" Padding="24" Spacing="12"
                Background="{ThemeResource ApplicationPageBackgroundThemeBrush}">
${sample.body}
${status}
    </StackPanel>
  </ScrollViewer>
</Window>
`,
    'MainWindow.xaml.h': `#pragma once
#include "MainWindow.g.h"
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Xaml.Controls.h>
#include <winrt/Microsoft.UI.Xaml.Data.h>
#include <winrt/Microsoft.UI.Xaml.Automation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <chrono>
#include <cstdint>
#include <string>
#include <vector>
#include "TaskRules.h"
${sample.headerIncludes ?? ''}

namespace mux = winrt::Microsoft::UI::Xaml;
namespace wf = winrt::Windows::Foundation;

namespace winrt::VoltQuestDesktop::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();
        void Window_Closed(wf::IInspectable const&, mux::WindowEventArgs const&);
        ${sample.methods.includes('MainWindow::Action_Click') ? `${sample.async ? 'winrt::fire_and_forget' : 'void'} Action_Click(${actionSignature});` : ''}
        ${sample.declarations ?? ''}
    private:
        bool m_closed = false;
        ${sample.fields ?? ''}
    };
}

namespace winrt::VoltQuestDesktop::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow> {};
}
`,
    'MainWindow.xaml.cpp': `#include "pch.h"
#include "MainWindow.xaml.h"
#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#endif
${sample.includes ?? ''}

namespace winrt::VoltQuestDesktop::implementation
{
MainWindow::MainWindow()
{
    InitializeComponent();
${sample.init ?? ''}
}

${sample.closeMethod ?? closeMethod}
${sample.methods}}
`,
    'MainWindow.idl': 'namespace VoltQuestDesktop\n{\n    [default_interface]\n    runtimeclass MainWindow : Microsoft.UI.Xaml.Window\n    {\n        MainWindow();\n    }\n}\n',
    'TaskRules.h': taskRules,
    'TaskRules.test.cpp': taskRulesTest,
  }
  if (['winui-files', 'winui-capstone'].includes(course.id)) files['TextFile.h'] = textFile
  if (course.id === 'winui-api') Object.assign(files, apiFiles)
  files['README.md'] = `# ${course.title}

${course.summary}

## Build on Windows

1. Install Visual Studio with a C++ toolset, Windows SDK and C++ WinUI templates.
   Use a supported Windows development machine or VM. Check the current Microsoft
   prerequisites: https://learn.microsoft.com/en-us/windows/apps/dev-tools/visual-studio
2. Create a packaged WinUI desktop app with Language C++ named VoltQuestDesktop.
   Template wording can be WinUI Blank App (Packaged) or Blank App, Packaged
   (WinUI 3 in Desktop). This is not a C# or UWP/WinUI 2 project.
3. Build and launch the unchanged template first. Record Visual Studio, Windows SDK
   and the exact stable Microsoft.WindowsAppSDK NuGet version selected by your template.
4. Back up your project. Replace MainWindow.xaml, MainWindow.xaml.h,
   MainWindow.xaml.cpp and MainWindow.idl with these files. Keep the template App,
   pch, project, manifest and assets. If the template uses MainWindow.h/MainWindow.cpp
   names, retain those project filenames and adjust the include in the .cpp to match.
   Do not add a second MainWindow implementation or edit generated .g.* files.
5. Put TaskRules.h${files['TextFile.h'] ? ' and TextFile.h' : ''} next to MainWindow.xaml.cpp.
   They are header-only helpers. Keep TaskRules.test.cpp OUT of the WinUI project:
   it has a separate console main function.
6. In project properties choose C++20 (/std:c++20) and /utf-8 for all configurations
   being tested. Use the template's C++/WinRT integration and matching x64/ARM64
   configuration. Rebuild the project so IDL and XAML regenerate their outputs.
7. Launch with F5, then run the steps below. These are complete MainWindow replacement
   sources, not a standalone .sln, compiled EXE, signed MSIX or browser simulation.

## Guided Windows lab

${course.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Expected observation (verify it yourself on Windows):
${course.expected}

${course.id === 'winui-api' ? apiInstructions : ''}

## Portable rule regression

From a Visual Studio Developer Command Prompt in this source directory:

    cl /nologo /std:c++20 /EHsc /utf-8 TaskRules.test.cpp /Fe:TaskRules.test.exe
    TaskRules.test.exe

Or, with a standard C++ compiler (this runs the portable rules only):

    c++ -std=c++20 -Wall -Wextra -pedantic TaskRules.test.cpp -o TaskRules.test
    ./TaskRules.test

The program reports 18 checks and exits with failure when a rule check fails.
On Windows wchar_t uses UTF-16 units. The non-Windows tests do not establish full
Unicode grapheme behavior or any WinUI native compatibility.

## Scope and verification

VoltQuest displays and downloads native code; it does not compile or run WinUI.
Source structure, portable C++ rule tests and course/browser behavior are separate
from Windows SDK compilation, UI Automation, Narrator and installed MSIX testing.
No Windows native build or installation was executed in the authoring macOS workspace.
The samples are intentionally small and use the template's dependencies rather than
inventing a universal project file. Verify your exact Windows toolchain before shipping.

${course.id === 'winui-capstone' ? 'The capstone saves voltquest-tasks-v1.json in ApplicationData.Current.LocalFolder,\nrequires packaged app identity, supports up to 100 titles and explicitly loads on request.\nIt serializes operations and validates the complete loaded document before replacement.\nA failed replacement write can damage the previous disk file: this teaching example is\nnot a crash-proof database. Use a disposable app-data profile for corruption tests.\n' : ''}
${course.id === 'winui-async' ? 'Cancel invalidates a pending preview result; its demonstration timer is not canceled.\n' : ''}
${course.id === 'winui-files' ? 'The file viewer uses Windows.Storage.Pickers with HWND initialization, a 64 KiB\nread bound and UTF-8. It is not the newer Microsoft.Windows.Storage.Pickers API.\n' : ''}
## Applied challenge

${course.challenge.task}
${course.challenge.acceptance.map(item => `- ${item}`).join('\n')}

## Reference reading (reviewed 2026-09-20)

${course.sources.map(source => `- [${source.title}](${source.url})`).join('\n')}
`
  files['RELEASE-CHECKLIST.md'] = `# Windows verification record

Mark each item PASS, FAIL or NOT RUN; include actual observations.

- OS/build, architecture, Visual Studio, Windows SDK, Windows App SDK version:
- Unmodified C++ template builds and launches:
- Lesson pack builds and launches in Debug and Release:
- Guided steps and expected values:
- Invalid inputs preserve accepted state:
- Keyboard order, activation and error recovery:
- Narrow/short window, text scaling, light/dark and contrast themes:
- Narrator names, roles and status announcements:
- Async cancellation/supersession, failed operations and closing during work:
- Capstone save → close → relaunch → explicit load:
- Installed Release launch outside Visual Studio:
- Fresh install and update with intended identity/runtime dependencies:

The source pack provides no signing credentials or prebuilt installer.
Only record checks you actually executed; website checks do not test the native UI.
`
  return files
}
