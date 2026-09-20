#pragma once
#include "Work.h"
#include <QtConcurrentRun>
#include <QFutureWatcher>
#include <QWidget>
#include <QVBoxLayout>
#include <QSpinBox>
#include <QPushButton>
#include <QLabel>

class LessonWindow : public QWidget {
    std::shared_ptr<std::atomic_bool> cancellation;
public:
    QSpinBox *limit;
    QPushButton *start;
    QPushButton *cancel;
    QLabel *status;
    QFutureWatcher<WorkResult> *watcher;
    LessonWindow() {
        setWindowTitle("Qt background arithmetic");
        auto *layout = new QVBoxLayout(this);
        limit = new QSpinBox(this); limit->setRange(1, 100000000); limit->setValue(1000); limit->setAccessibleName("Upper limit N");
        start = new QPushButton("Start sum", this);
        cancel = new QPushButton("Cancel work", this); cancel->setEnabled(false);
        status = new QLabel("Choose N, then sum 1 through N in a worker.", this); status->setWordWrap(true);
        watcher = new QFutureWatcher<WorkResult>(this);
        for (auto *widget : QVector<QWidget*>{limit, start, cancel, status}) layout->addWidget(widget);
        connect(start, &QPushButton::clicked, this, [this] {
            if (watcher->isRunning()) return;
            const int n = limit->value();
            cancellation = std::make_shared<std::atomic_bool>(false);
            const auto token = cancellation;
            start->setEnabled(false); cancel->setEnabled(true); status->setText("Working…");
            watcher->setFuture(QtConcurrent::run([n, token] { return sumNumbers(n, token); }));
        });
        connect(cancel, &QPushButton::clicked, this, [this] { if (cancellation) cancellation->store(true); });
        connect(watcher, &QFutureWatcher<WorkResult>::finished, this, [this] {
            const auto result = watcher->result();
            status->setText(result.cancelled ? "Work cancelled." : QString("Sum: %1").arg(result.sum));
            start->setEnabled(true); cancel->setEnabled(false);
        });
        resize(480, 250);
    }
    ~LessonWindow() override { if (cancellation) cancellation->store(true); }
};
