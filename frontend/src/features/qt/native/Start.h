#pragma once
#include <QWidget>
#include <QPushButton>
#include <QLabel>
#include <QVBoxLayout>

class LessonWindow : public QWidget {
public:
    int count = 0;
    QLabel *label;
    QPushButton *button;
    LessonWindow() {
        setWindowTitle("My first Qt app");
        auto *layout = new QVBoxLayout(this);
        label = new QLabel("Clicks: 0", this);
        button = new QPushButton("&Count a click", this);
        layout->addWidget(label); layout->addWidget(button);
        connect(button, &QPushButton::clicked, this, [this] {
            label->setText(QString("Clicks: %1").arg(++count));
        });
        resize(400, 180);
    }
};
