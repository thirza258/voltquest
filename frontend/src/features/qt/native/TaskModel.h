#pragma once
#include "Task.h"
#include <QAbstractListModel>
#include <QSet>

class TaskModel : public QAbstractListModel {
    Q_OBJECT
public:
    explicit TaskModel(QObject *parent = nullptr) : QAbstractListModel(parent) {}
    int rowCount(const QModelIndex &parent = {}) const override {
        return parent.isValid() ? 0 : int(tasks.size());
    }
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override {
        if (!index.isValid() || index.model() != this || index.column() != 0 || index.row() < 0 || index.row() >= tasks.size()) return {};
        const auto &task = tasks[index.row()];
        if (role == Qt::DisplayRole || role == Qt::EditRole) return task.title;
        if (role == Qt::CheckStateRole) return task.done ? Qt::Checked : Qt::Unchecked;
        if (role == Qt::UserRole) return task.id;
        return {};
    }
    Qt::ItemFlags flags(const QModelIndex &index) const override {
        if (!index.isValid()) return Qt::NoItemFlags;
        return QAbstractListModel::flags(index) | Qt::ItemIsEditable | Qt::ItemIsUserCheckable;
    }
    bool setData(const QModelIndex &index, const QVariant &value, int role) override {
        if (!index.isValid() || index.model() != this || index.row() < 0 || index.row() >= tasks.size()) return false;
        auto &task = tasks[index.row()];
        if (role == Qt::EditRole) {
            if (!validTitle(value.toString())) return false;
            if (task.title == value.toString().trimmed()) return true;
            task.title = value.toString().trimmed();
        } else if (role == Qt::CheckStateRole) {
            if (value.toInt() != Qt::Checked && value.toInt() != Qt::Unchecked) return false;
            if (task.done == (value.toInt() == Qt::Checked)) return true;
            task.done = value.toInt() == Qt::Checked;
        } else return false;
        emit dataChanged(index, index, {role, Qt::DisplayRole});
        emit changed();
        return true;
    }
    bool add(const QString &title) {
        if (!validTitle(title) || tasks.size() >= MaxTasks) return false;
        const int row = int(tasks.size());
        beginInsertRows({}, row, row);
        tasks.push_back(newTask(title));
        endInsertRows();
        emit changed();
        return true;
    }
    bool removeAt(int row) {
        if (row < 0 || row >= tasks.size()) return false;
        beginRemoveRows({}, row, row);
        tasks.removeAt(row);
        endRemoveRows();
        emit changed();
        return true;
    }
    QVector<Task> snapshot() const { return tasks; }
    bool replace(const QVector<Task> &candidate) {
        if (candidate.size() > MaxTasks) return false;
        QSet<QString> ids;
        for (const auto &task : candidate) {
            if (!validTitle(task.title) || QUuid(task.id).isNull() || ids.contains(task.id)) return false;
            ids.insert(task.id);
        }
        beginResetModel();
        tasks = candidate;
        endResetModel();
        emit changed();
        return true;
    }
signals:
    void changed();
private:
    QVector<Task> tasks;
};
