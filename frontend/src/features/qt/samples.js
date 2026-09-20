import { QT_TEST_CASES } from './testCases.js'

const native = import.meta.glob('./native/*', { query: '?raw', import: 'default', eager: true })
const read = name => {
  const source = native[`./native/${name}`]
  if (typeof source !== 'string') throw new Error(`Missing Qt lesson source: ${name}`)
  return source
}
const modelFiles = ['Task.h', 'TaskModel.h', 'TaskEditor.h']
const notebookFiles = [...modelFiles, 'TaskFile.h', 'Notebook.h']
const definitions = {
  start: ['Start.h', [], []],
  cpp: ['Cpp.h', ['CounterController.h'], []],
  layout: ['Layout.h', ['Task.h', 'Form.ui'], []],
  events: ['Events.h', modelFiles, []],
  mainwindow: ['Mainwindow.h', [], []],
  models: ['Models.h', modelFiles, []],
  files: ['Files.h', notebookFiles, []],
  sql: ['Sql.h', ['Task.h', 'SqlTasks.h'], ['Sql']],
  network: ['Network.h', ['NetworkClient.h', 'fixture.py'], ['Network']],
  async: ['Async.h', ['Work.h'], ['Concurrent']],
  graphics: ['Graphics.h', [], []],
  qml: [null, ['CounterBackend.h', 'Main.qml'], ['Quick', 'QuickControls2']],
  localization: ['Localization.h', ['lesson_id.ts'], ['LinguistTools']],
  testing: ['Testing.h', notebookFiles, []],
  deployment: ['Deployment.h', ['about.txt'], []],
  capstone: ['Capstone.h', notebookFiles, []],
}

function cmake(course, files, modules) {
  const slug = course.id.slice(3), app = course.id.replaceAll('-', '_')
  const runtime = [slug === 'qml' ? 'Quick' : 'Widgets', ...modules.filter(module => !['LinguistTools', 'Quick'].includes(module))]
  const headers = Object.keys(files).filter(name => name.endsWith('.h') || name.endsWith('.ui')).join(' ')
  let source = `cmake_minimum_required(VERSION 3.21)
project(${app} VERSION 1.0.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
find_package(Qt6 6.5 REQUIRED COMPONENTS ${[...new Set([...runtime, ...modules])].join(' ')})
qt_standard_project_setup(REQUIRES 6.5)
include(CTest)

qt_add_executable(${app} main.cpp ${headers})
target_include_directories(${app} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(${app} PRIVATE ${runtime.map(module => `Qt6::${module}`).join(' ')})
set_target_properties(${app} PROPERTIES
    WIN32_EXECUTABLE ON MACOSX_BUNDLE ON
    MACOSX_BUNDLE_GUI_IDENTIFIER "org.voltquest.lessons.${app}"
    MACOSX_BUNDLE_BUNDLE_VERSION "1.0.0")
if(MSVC)
    target_compile_options(${app} PRIVATE /utf-8 /W4)
else()
    target_compile_options(${app} PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(BUILD_TESTING)
    find_package(Qt6 6.5 REQUIRED COMPONENTS Test)
    qt_add_executable(${app}_tests tests.cpp ${headers})
    target_include_directories(${app}_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
    target_link_libraries(${app}_tests PRIVATE Qt6::Test ${runtime.map(module => `Qt6::${module}`).join(' ')})
    if(MSVC)
        target_compile_options(${app}_tests PRIVATE /utf-8)
    endif()
    add_test(NAME ${app}_behavior COMMAND ${app}_tests)
    set_tests_properties(${app}_behavior PROPERTIES TIMEOUT 30
        ENVIRONMENT "QT_QPA_PLATFORM=offscreen;QT_QUICK_BACKEND=software")
endif()
`
  if (slug === 'qml') source += `
foreach(target IN ITEMS ${app} ${app}_tests)
    if(TARGET ${target})
        qt_add_qml_module(${target}
            URI VoltQuest.Lesson VERSION 1.0
            OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/${target}_qml
            QML_FILES Main.qml
            SOURCES CounterBackend.h)
    endif()
endforeach()
`
  if (slug === 'localization') source += `
set(qm_file ${CMAKE_CURRENT_BINARY_DIR}/lesson_id.qm)
add_custom_command(OUTPUT ${qm_file}
    COMMAND Qt6::lrelease ${CMAKE_CURRENT_SOURCE_DIR}/lesson_id.ts -qm ${qm_file}
    DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/lesson_id.ts VERBATIM)
foreach(target IN ITEMS ${app} ${app}_tests)
    if(TARGET ${target})
        qt_add_resources(${target} "translations" PREFIX "/i18n"
            BASE ${CMAKE_CURRENT_BINARY_DIR} FILES ${qm_file})
    endif()
endforeach()
`
  if (slug === 'deployment') source += `
foreach(target IN ITEMS ${app} ${app}_tests)
    if(TARGET ${target})
        qt_add_resources(${target} "lesson_data" PREFIX "/lesson" FILES about.txt)
    endif()
endforeach()
`
  source += `
install(TARGETS ${app}
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
option(VQ_DEPLOY "Collect Qt runtime dependencies during installation" OFF)
if(VQ_DEPLOY)
    ${slug === 'qml' ? 'qt_generate_deploy_qml_app_script' : 'qt_generate_deploy_app_script'}(
        TARGET ${app} OUTPUT_SCRIPT deploy_script)
    install(SCRIPT ${deploy_script})
endif()
`
  return source
}

function main(course) {
  const slug = course.id.slice(3)
  if (slug === 'qml') return `#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QTimer>
int main(int argc, char *argv[]) {
    QGuiApplication application(argc, argv);
    QCoreApplication::setOrganizationName("VoltQuestLessons");
    QCoreApplication::setApplicationName("qt-qml");
    QQmlApplicationEngine engine;
    engine.loadFromModule("VoltQuest.Lesson", "Main");
    if (engine.rootObjects().isEmpty()) return 1;
    if (application.arguments().contains("--smoke-test"))
        QTimer::singleShot(150, &application, &QCoreApplication::quit);
    return application.exec();
}
`
  return `#include <QApplication>
#include <QTimer>
#include "Lesson.h"
int main(int argc, char *argv[]) {
    QApplication application(argc, argv);
    QCoreApplication::setOrganizationName("VoltQuestLessons");
    QCoreApplication::setApplicationName("${course.id}");
${slug === 'sql' ? `    QString databasePath;
    const auto arguments = application.arguments();
    const int flag = arguments.indexOf("--database");
    if (flag >= 0) {
        if (flag + 1 >= arguments.size()) return 2;
        databasePath = arguments[flag + 1];
    }
    LessonWindow window(databasePath);` : '    LessonWindow window;'}
    window.show();
    // Verification helper: startup only, not a replacement for interaction tests.
    if (application.arguments().contains("--smoke-test"))
        QTimer::singleShot(150, &application, &QCoreApplication::quit);
    return application.exec();
}
`
}

function tests(slug) {
  return `#include <QtTest>
#include <QSignalSpy>
#include <QTemporaryDir>
#include <QAbstractItemModelTester>
#include <QPointer>
#include <QTimer>
#include <QStandardPaths>
${slug === 'network' ? '#include <QTcpServer>\n#include <QTcpSocket>\n#include <QHostAddress>\n' : ''}${slug === 'qml' ? '#include <QQmlApplicationEngine>\n' : ''}#include "Lesson.h"

class LessonTests : public QObject {
    Q_OBJECT
private slots:
    void initTestCase() {
        QCoreApplication::setOrganizationName("VoltQuestNativeTests");
        QCoreApplication::setApplicationName("qt-${slug}-tests");
        QStandardPaths::setTestModeEnabled(true);
        // Isolate any QSettings access inside the temporary test profile.
        QSettings::setDefaultFormat(QSettings::IniFormat);
        QSettings::setPath(QSettings::IniFormat, QSettings::UserScope, profile.path());
    }
${QT_TEST_CASES[slug]}
private:
    QTemporaryDir profile;
};
QTEST_MAIN(LessonTests)
#include "tests.moc"
`
}

export function getQtFiles(course) {
  const slug = course.id.slice(3), definition = definitions[slug]
  if (!definition) throw new Error(`Unknown Qt course: ${course.id}`)
  const [lesson, dependencies, modules] = definition
  const files = { 'main.cpp': main(course), 'Lesson.h': lesson ? read(lesson) : '#pragma once\n#include "CounterBackend.h"\n// The native QML view is in Main.qml; main.cpp loads its module.\n' }
  for (const name of dependencies) files[name] = read(name)
  files['tests.cpp'] = tests(slug).replace('#include <QStandardPaths>', '#include <QStandardPaths>\n#include <QSettings>')
  files['CMakeLists.txt'] = cmake(course, files, modules)
  const app = course.id.replaceAll('-', '_')
  files['README.md'] = `# ${course.title}

${course.summary}

## Requirements

Use a desktop Qt 6.5 or newer kit, a compatible C++17 compiler and CMake 3.21 or
newer (or the higher CMake minimum required by your selected Qt release).
Install ${slug === 'qml' ? 'Qt Quick and Qt Quick Controls' : 'Qt Widgets'}${modules.filter(m => !['Quick', 'QuickControls2'].includes(m)).map(m => `, Qt ${m}`).join('')}, plus Qt Test. Qt Creator is optional.
Choose a compiler/architecture matching the Qt binaries: MSVC with an MSVC Qt kit,
MinGW with a MinGW Qt kit, and the appropriate native kit on macOS or Linux.
This ZIP is a complete source project. Extract it into its own directory.

## Build, run and test

Open CMakeLists.txt in Qt Creator and select your desktop kit, or run:

    cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DCMAKE_PREFIX_PATH="<absolute Qt kit prefix>"
    cmake --build build --config Debug
    ctest --test-dir build -C Debug --output-on-failure

Replace the kit prefix with the directory containing your Qt installation.
For an installation already discoverable by CMake, omit CMAKE_PREFIX_PATH.
On a Windows multi-configuration generator, launch build/Debug/${app}.exe.
On a Linux single-configuration generator, launch ./build/${app}.
On macOS, launch ./build/${app}.app/Contents/MacOS/${app}.
Qt Creator's Run action selects the built application for the chosen kit.

${slug === 'network' ? 'Run `python3 fixture.py` in a separate terminal first. On Windows, `py fixture.py` also works. The fixture binds only 127.0.0.1:8765. Fetch is explicit; there is no automatic external network request. Ctrl+C stops the fixture.\n\n' : ''}${slug === 'sql' ? 'For a disposable database, pass `--database "<absolute path to test.sqlite>"` to the executable. Otherwise it stores tasks.sqlite under QStandardPaths::AppLocalDataLocation for this lesson. Restart with the same path to verify persistence.\n\n' : ''}${slug === 'localization' ? 'CMake runs the kit\'s lrelease to compile lesson_id.ts and embeds lesson_id.qm. The sample switches language for the current run; persistent language choice is an extension exercise.\n\n' : ''}CTest runs the exact tests.cpp against the same lesson headers and resources as
the app, using Qt's offscreen platform and software Qt Quick rendering. These
checks exercise real Qt behavior, but do not certify native dialogs, GPU rendering,
assistive tools, installers or other operating systems. --smoke-test starts the app
and exits automatically; it establishes startup only. Record manual target results.

## Guided lab

${course.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Expected: ${course.expected}

## Boundaries

VoltQuest displays and downloads this source. It does not compile or execute Qt,
C++, QML, shell commands or host filesystem operations in the browser or backend.
Native apps run with the learner's normal operating-system permissions.
${notebookFiles.some(name => name in files) ? 'Task titles reject control characters and are limited to 80 UTF-16 units, not grapheme clusters. There are at most 100 tasks and JSON files are limited to 64 KiB. Save writes accepted tasks only; an unadded input draft is excluded and is protected by discard confirmation on New/Open/Close. Loading validates a complete temporary document before replacement. QSaveFile keeps direct-write fallback disabled. Geometry preferences are separate from user documents.\n' : ''}
## Release staging

For a supported host/target configuration, enable dependency collection:

    cmake -S . -B release -DCMAKE_BUILD_TYPE=Release -DVQ_DEPLOY=ON -DCMAKE_PREFIX_PATH="<absolute Qt kit prefix>"
    cmake --build release --config Release
    cmake --install release --config Release --prefix stage

A dependency helper error is a failed deployment, not a successful package.
Without VQ_DEPLOY the install rule stages the app without collecting Qt runtime
dependencies. Use the official deployment guide for your kit and platform.
Staging does not sign, notarize, create an installer or publish anything.
Test on a clean target and complete RELEASE-CHECKLIST.md before distributing.

## Applied challenge

${course.challenge.task}
${course.challenge.acceptance.map(item => `- ${item}`).join('\n')}

## References reviewed ${'2026-09-20'}

${course.sources.map(source => `- ${source.title}: ${source.url}`).join('\n')}
`
  files['RELEASE-CHECKLIST.md'] = `# ${course.title}: learner verification record

Initial status: NOT RUN. Fill this out with your own executed results.

- Host OS, version and architecture: NOT RUN
- Qt kit, compiler, CMake and build configuration: NOT RUN
- Configure and compile exact source: NOT RUN
- CTest behavior and any failures: NOT RUN
- Actual app launch and guided lab observations: NOT RUN
- Keyboard, large-font/scaling and native assistive tool review: NOT RUN
- Cancel/error paths and persistence readback (where applicable): NOT RUN
- Staged artifact launched outside the source directory: NOT RUN
- Clean Windows target and runtime plugins: NOT RUN
- Clean macOS target and bundle dependencies: NOT RUN
- Clean Linux target and distribution dependencies: NOT RUN
- Dependency licenses/notices for chosen distribution: NOT RUN
- Signing/installer/notarization where applicable: NOT RUN
- Upgrade with existing user data preserved: NOT RUN

A source download, browser exam or source-text inspection does not establish a
native build or release. Keep build logs and exact observed results with this record.
`
  return files
}
