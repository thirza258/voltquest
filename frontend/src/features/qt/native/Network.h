#pragma once
#include "NetworkClient.h"
#include <QWidget>
#include <QVBoxLayout>
#include <QLabel>
#include <QPushButton>

class LessonWindow : public QWidget {
public:
    NetworkClient *client;
    QPushButton *fetch;
    QLabel *status;
    LessonWindow() {
        setWindowTitle("Qt local HTTP client");
        auto *layout = new QVBoxLayout(this);
        client = new NetworkClient(this);
        status = new QLabel("Run fixture.py, then fetch http://127.0.0.1:8765/tasks", this);
        status->setTextFormat(Qt::PlainText); status->setWordWrap(true);
        fetch = new QPushButton("Fetch local fixture", this);
        auto *cancel = new QPushButton("Cancel request", this);
        layout->addWidget(status); layout->addWidget(fetch); layout->addWidget(cancel);
        connect(fetch, &QPushButton::clicked, this, [this] {
            if (client->fetch()) { status->setText("Waiting for local response…"); fetch->setEnabled(false); }
        });
        connect(cancel, &QPushButton::clicked, client, &NetworkClient::cancel);
        connect(client, &NetworkClient::settled, this, [this](bool ok, const QString &message) {
            fetch->setEnabled(true); status->setText((ok ? "Received: " : "Error: ") + message);
        });
        resize(540, 220);
    }
};
