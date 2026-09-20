#pragma once
#include "CounterController.h"
#include <QWidget>
#include <QVBoxLayout>
#include <QLabel>
#include <QPushButton>

class LessonWindow : public QWidget {
public:
    CounterController *controller;
    QLabel *label;
    QPushButton *button;
    LessonWindow() {
        setWindowTitle("C++ ownership and Qt objects");
        auto *layout = new QVBoxLayout(this);
        controller = new CounterController(this);
        label = new QLabel("Count: 0", this);
        button = new QPushButton("&Increment", this);
        layout->addWidget(label); layout->addWidget(button);
        connect(button, &QPushButton::clicked, controller, &CounterController::increment);
        connect(controller, &CounterController::countChanged, this, [this](int value) {
            label->setText(QString("Count: %1").arg(value));
        });
        resize(420, 180);
    }
};
