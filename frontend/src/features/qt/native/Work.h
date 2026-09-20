#pragma once
#include <QtGlobal>
#include <atomic>
#include <memory>

struct WorkResult { bool cancelled; quint64 sum; };
inline WorkResult sumNumbers(int limit, const std::shared_ptr<std::atomic_bool> &cancel) {
    if (limit < 1 || limit > 100000000 || cancel->load()) return {true, 0};
    quint64 sum = 0;
    for (int i = 1; i <= limit; ++i) {
        if ((i % 1024) == 0 && cancel->load()) return {true, 0};
        sum += quint64(i);
    }
    return {cancel->load(), sum};
}
