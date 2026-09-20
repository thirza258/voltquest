#pragma once
#include <cstddef>
#include <string>
#include <string_view>

namespace vq
{
    inline constexpr std::size_t max_title_units = 80;
    inline constexpr std::size_t max_tasks = 100;

    // ASCII edge whitespace only; deliberately not Unicode normalization.
    inline std::wstring clean_title(std::wstring_view input)
    {
        auto const first = input.find_first_not_of(L" \t");
        if (first == std::wstring_view::npos) return {};
        auto const last = input.find_last_not_of(L" \t");
        return std::wstring{ input.substr(first, last - first + 1) };
    }

    // wchar_t units are UTF-16 code units on Windows, not grapheme clusters.
    inline std::wstring title_error(std::wstring_view title)
    {
        if (title.empty()) return L"Enter a task title.";
        if (title.size() > max_title_units) return L"Use at most 80 title units.";
        for (auto ch : title)
            if (static_cast<unsigned long>(ch) < 32 || ch == 127)
                return L"Use a single line without control characters.";
        return {};
    }

    inline bool valid_selection(int index, std::size_t size)
    {
        return index >= 0 && static_cast<std::size_t>(index) < size;
    }
}
