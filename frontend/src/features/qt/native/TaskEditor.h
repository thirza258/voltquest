#pragma once
#include "TaskModel.h"
#include <QWidget>
#include <QLineEdit>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QListView>
#include <QSortFilterProxyModel>

class TaskEditor : public QWidget {
public:
    TaskModel *model;
    QSortFilterProxyModel *proxy;
    QListView *list;
    QLineEdit *input;
    QLineEdit *search;
    QLabel *status;
    QPushButton *addButton;
    QPushButton *removeButton;
    explicit TaskEditor(QWidget *parent = nullptr) : QWidget(parent) {
        model = new TaskModel(this);
        proxy = new QSortFilterProxyModel(this);
        proxy->setSourceModel(model);
        proxy->setFilterCaseSensitivity(Qt::CaseInsensitive);
        proxy->setSortCaseSensitivity(Qt::CaseInsensitive);
        proxy->sort(0);
        auto *layout = new QVBoxLayout(this);
        input = new QLineEdit(this);
        input->setAccessibleName("New task title");
        input->setPlaceholderText("Task title, up to 80 UTF-16 units");
        auto *label = new QLabel("&Task title", this); label->setBuddy(input);
        addButton = new QPushButton("&Add task", this);
        search = new QLineEdit(this);
        search->setAccessibleName("Filter tasks"); search->setPlaceholderText("Filter tasks");
        list = new QListView(this); list->setModel(proxy); list->setAccessibleName("Tasks");
        removeButton = new QPushButton("&Remove selected", this);
        status = new QLabel("No tasks yet.", this); status->setTextFormat(Qt::PlainText); status->setWordWrap(true);
        layout->addWidget(label); layout->addWidget(input); layout->addWidget(addButton);
        layout->addWidget(search); layout->addWidget(list); layout->addWidget(removeButton); layout->addWidget(status);
        connect(search, &QLineEdit::textChanged, proxy, &QSortFilterProxyModel::setFilterFixedString);
        connect(addButton, &QPushButton::clicked, this, [this] {
            if (!model->add(input->text())) { status->setText("Use a nonempty title without control characters, at most 80 UTF-16 units; maximum 100 tasks."); return; }
            input->clear(); input->setFocus();
            status->setText(QString("%1 tasks. Double-click a title to edit; use the checkbox to complete.").arg(model->rowCount()));
        });
        connect(input, &QLineEdit::returnPressed, addButton, &QPushButton::click);
        connect(removeButton, &QPushButton::clicked, this, [this] {
            const auto source = proxy->mapToSource(list->currentIndex());
            if (!source.isValid() || !model->removeAt(source.row())) { status->setText("Select a task first."); return; }
            status->setText(QString("%1 tasks remain.").arg(model->rowCount()));
        });
        resize(560, 440);
    }
};
