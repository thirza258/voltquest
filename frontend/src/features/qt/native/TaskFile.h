#pragma once
#include "Task.h"
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSaveFile>
#include <QSet>

inline constexpr qint64 MaxFileBytes = 64 * 1024;
inline bool decodeTasks(const QByteArray &bytes, QVector<Task> &result, QString &error) {
    error.clear();
    if (bytes.size() > MaxFileBytes) { error = "File exceeds 64 KiB."; return false; }
    QJsonParseError parse;
    const auto document = QJsonDocument::fromJson(bytes, &parse);
    const auto root = document.object();
    if (parse.error != QJsonParseError::NoError || !document.isObject()
        || !root["version"].isDouble() || root["version"].toDouble() != 1.0 || !root["tasks"].isArray()) {
        error = "Expected a version-1 task document."; return false;
    }
    const auto array = root["tasks"].toArray();
    if (array.size() > MaxTasks) { error = "At most 100 tasks are supported."; return false; }
    QVector<Task> candidate;
    QSet<QString> ids;
    for (const auto &value : array) {
        const auto item = value.toObject();
        const QString id = item["id"].toString(), title = item["title"].toString();
        if (!value.isObject() || !item["id"].isString() || QUuid(id).isNull()
            || id != QUuid(id).toString(QUuid::WithoutBraces) || ids.contains(id)
            || !item["title"].isString() || !validTitle(title) || !item["done"].isBool()) {
            error = "A task has an invalid or duplicate id, title or completion value."; return false;
        }
        ids.insert(id);
        candidate.push_back({id, title.trimmed(), item["done"].toBool()});
    }
    result = candidate; // Commit only after validating the entire document.
    return true;
}
inline QByteArray encodeTasks(const QVector<Task> &tasks) {
    QJsonArray array;
    for (const auto &task : tasks)
        array.append(QJsonObject{{"id", task.id}, {"title", task.title}, {"done", task.done}});
    return QJsonDocument(QJsonObject{{"version", 1}, {"tasks", array}}).toJson();
}
inline bool loadTasks(const QString &path, QVector<Task> &result, QString &error) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) { error = file.errorString(); return false; }
    const auto bytes = file.read(MaxFileBytes + 1);
    if (file.error() != QFileDevice::NoError) { error = file.errorString(); return false; }
    return decodeTasks(bytes, result, error);
}
inline bool saveTasks(const QString &path, const QVector<Task> &tasks, QString &error) {
    const auto bytes = encodeTasks(tasks);
    QVector<Task> checked;
    if (!decodeTasks(bytes, checked, error)) return false;
    QSaveFile file(path); // Keep the default: no direct-write fallback.
    if (!file.open(QIODevice::WriteOnly)) { error = file.errorString(); return false; }
    if (file.write(bytes) != bytes.size()) {
        error = file.errorString(); file.cancelWriting(); return false;
    }
    if (!file.commit()) { error = file.errorString(); return false; }
    return true;
}
