#pragma once
#include "SqlTasks.h"
#include <QWidget>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QListWidget>
#include <QStandardPaths>
#include <QDir>

class LessonWindow : public QWidget {
public:
    SqlTasks repository;
    QLineEdit *input;
    QListWidget *list;
    QLabel *status;
    QPushButton *addButton;
    explicit LessonWindow(QString path = {}) {
        setWindowTitle("Qt SQL task repository");
        auto *layout = new QVBoxLayout(this);
        input = new QLineEdit(this); input->setAccessibleName("Task title"); input->setPlaceholderText("Task title");
        addButton = new QPushButton("Add to database", this);
        list = new QListWidget(this); list->setAccessibleName("Stored tasks");
        auto *toggle = new QPushButton("Toggle selected completion", this);
        auto *remove = new QPushButton("Delete selected", this);
        status = new QLabel(this); status->setTextFormat(Qt::PlainText); status->setWordWrap(true);
        for (auto *widget : QVector<QWidget*>{input, addButton, list, toggle, remove, status}) layout->addWidget(widget);
        if (path.isEmpty()) {
            const auto directory = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
            if (directory.isEmpty() || !QDir().mkpath(directory)) {
                status->setText("Cannot create the local data directory."); addButton->setEnabled(false); return;
            }
            path = directory + "/tasks.sqlite";
        }
        const bool ready = repository.open(path);
        status->setText(ready ? "Database: " + path : repository.error);
        addButton->setEnabled(ready); toggle->setEnabled(ready); remove->setEnabled(ready);
        if (ready) refresh();
        connect(addButton, &QPushButton::clicked, this, [this] {
            if (repository.add(input->text())) { input->clear(); refresh(); }
            else status->setText(repository.error);
        });
        auto change = [this](bool deleting) {
            const auto *item = list->currentItem();
            if (!item) { status->setText("Select a stored task first."); return; }
            if (!repository.mutate(item->data(Qt::UserRole).toLongLong(), deleting)) status->setText(repository.error);
            else refresh();
        };
        connect(toggle, &QPushButton::clicked, this, [change] { change(false); });
        connect(remove, &QPushButton::clicked, this, [change] { change(true); });
        resize(600, 440);
    }
    void refresh() {
        QVector<SqlTask> tasks;
        if (!repository.all(tasks)) { status->setText(repository.error); return; }
        list->clear();
        for (const auto &task : tasks) {
            auto *item = new QListWidgetItem((task.done ? "[done] " : "[open] ") + task.title, list);
            item->setData(Qt::UserRole, task.id);
        }
    }
};
