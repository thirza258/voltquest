#include "TaskRules.h"
#include <iostream>
#include <stdexcept>

int main()
{
    int checks = 0;
    auto check = [&](bool condition) {
        ++checks;
        if (!condition) throw std::runtime_error("TaskRules regression failed");
    };
    check(vq::clean_title(L"  Read XAML\t ") == L"Read XAML");
    check(vq::clean_title(L" \t ").empty());
    check(vq::clean_title(L"two  spaces") == L"two  spaces");
    check(!vq::title_error(L"").empty());
    check(vq::title_error(std::wstring(80, L'x')).empty());
    check(!vq::title_error(std::wstring(81, L'x')).empty());
    check(!vq::title_error(L"two\nlines").empty());
    check(!vq::title_error(L"embedded\ttab").empty());
    check(!vq::title_error(std::wstring{L'a', L'\0', L'b'}).empty());
    check(!vq::title_error(std::wstring{L'a', wchar_t{127}}).empty());
    check(vq::title_error(L"caf\u00e9 \u65e5\u672c").empty());
    check(vq::clean_title(L"\u00a0title\u00a0") == L"\u00a0title\u00a0");
    check(!vq::valid_selection(-1, 2));
    check(!vq::valid_selection(0, 0));
    check(vq::valid_selection(0, 2));
    check(vq::valid_selection(1, 2));
    check(!vq::valid_selection(2, 2));
    check(vq::max_tasks == 100);
    std::cout << checks << " portable TaskRules checks passed\n";
}
