#pragma once
#include <QWidget>
#include <QVBoxLayout>
#include <QLabel>
#include <QFile>
#include <QCoreApplication>

class LessonWindow : public QWidget {
public:
    QLabel *label;
    LessonWindow() {
        setWindowTitle("Qt deployment resource check");
        auto *layout = new QVBoxLayout(this);
        QFile resource(":/lesson/about.txt");
        const QString text = resource.open(QIODevice::ReadOnly)
            ? QString::fromUtf8(resource.readAll()) : "ERROR: packaged resource missing.";
        label = new QLabel(text, this); label->setTextFormat(Qt::PlainText); label->setWordWrap(true);
        auto *location = new QLabel("Executable directory: " + QCoreApplication::applicationDirPath(), this);
        location->setTextFormat(Qt::PlainText); location->setWordWrap(true);
        layout->addWidget(label); layout->addWidget(location); resize(600, 240);
    }
};
