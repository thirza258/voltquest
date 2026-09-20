#pragma once
#include "Task.h"
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QSqlError>
#include <QVariant>

struct SqlTask { qint64 id; QString title; bool done; };
class SqlTasks {
    QString name = QUuid::createUuid().toString();
    QSqlDatabase db;
public:
    QString error;
    SqlTasks() : db(QSqlDatabase::addDatabase("QSQLITE", name)) {}
    SqlTasks(const SqlTasks &) = delete;
    SqlTasks &operator=(const SqlTasks &) = delete;
    ~SqlTasks() { db.close(); db = {}; QSqlDatabase::removeDatabase(name); }
    bool open(const QString &path) {
        db.setDatabaseName(path);
        if (!db.open()) { error = db.lastError().text(); return false; }
        int version = 0;
        { QSqlQuery q(db);
          if (!q.exec("PRAGMA user_version") || !q.next()) { error = q.lastError().text(); return false; }
          version = q.value(0).toInt(); }
        if (version != 0 && version != 1) { error = "Unsupported database schema version."; return false; }
        if (version == 1) return true;
        if (!db.transaction()) { error = db.lastError().text(); return false; }
        QSqlQuery q(db);
        if (!q.exec("CREATE TABLE tasks(id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL CHECK(done IN (0,1)))")
            || !q.exec("PRAGMA user_version = 1")) {
            error = q.lastError().text(); db.rollback(); return false;
        }
        if (!db.commit()) { error = db.lastError().text(); db.rollback(); return false; }
        return true;
    }
    bool all(QVector<SqlTask> &result) {
        QSqlQuery q(db);
        if (!q.exec("SELECT id, title, done FROM tasks ORDER BY id LIMIT 101")) { error = q.lastError().text(); return false; }
        QVector<SqlTask> candidate;
        while (q.next()) {
            const auto title = q.value(1).toString();
            const int done = q.value(2).toInt();
            if (!validTitle(title) || (done != 0 && done != 1) || candidate.size() >= MaxTasks) {
                error = "Invalid or oversized task table."; return false;
            }
            candidate.push_back({q.value(0).toLongLong(), title, done == 1});
        }
        if (q.lastError().isValid()) { error = q.lastError().text(); return false; }
        result = candidate; return true;
    }
    bool add(const QString &title) {
        if (!validTitle(title)) { error = "Invalid task title."; return false; }
        if (!db.transaction()) { error = db.lastError().text(); return false; }
        QSqlQuery q(db);
        if (!q.exec("SELECT COUNT(*) FROM tasks") || !q.next() || q.value(0).toInt() >= MaxTasks) {
            error = "Could not add: table unavailable or 100-task limit reached."; db.rollback(); return false;
        }
        q.finish();
        if (!q.prepare("INSERT INTO tasks(title, done) VALUES(:title, 0)")) {
            error = q.lastError().text(); db.rollback(); return false;
        }
        q.bindValue(":title", title.trimmed());
        if (!q.exec()) { error = q.lastError().text(); db.rollback(); return false; }
        q.finish();
        if (!db.commit()) { error = db.lastError().text(); db.rollback(); return false; }
        return true;
    }
    bool mutate(qint64 id, bool remove) {
        QSqlQuery q(db);
        const auto sql = remove ? "DELETE FROM tasks WHERE id=:id" : "UPDATE tasks SET done=1-done WHERE id=:id";
        if (!q.prepare(sql)) { error = q.lastError().text(); return false; }
        q.bindValue(":id", id);
        if (!q.exec()) { error = q.lastError().text(); return false; }
        if (q.numRowsAffected() != 1) { error = "Task no longer exists."; return false; }
        return true;
    }
};
