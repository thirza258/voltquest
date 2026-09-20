#pragma once
#include <QString>
#include <QVector>
#include <QUuid>

struct Task { QString id; QString title; bool done = false; };
inline constexpr int MaxTasks = 100;
inline constexpr int MaxTitleUnits = 80;

inline bool validTitle(const QString &title) {
    if (title.trimmed().isEmpty() || title.size() > MaxTitleUnits) return false;
    for (QChar character : title)
        if (character.category() == QChar::Other_Control) return false;
    return true;
}
inline Task newTask(const QString &title) {
    return {QUuid::createUuid().toString(QUuid::WithoutBraces), title.trimmed(), false};
}
