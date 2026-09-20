#pragma once
#include <QWidget>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QLabel>
#include <QPushButton>
#include <QTranslator>
#include <QCoreApplication>
#include <QEvent>

class LessonWindow : public QWidget {
    QTranslator translator;
public:
    QLineEdit *input;
    QLabel *label;
    QLabel *status;
    QPushButton *language;
    QPushButton *save;
    bool indonesian = false;
    LessonWindow() {
        auto *layout = new QVBoxLayout(this);
        label = new QLabel(this); input = new QLineEdit(this); label->setBuddy(input);
        save = new QPushButton(this); language = new QPushButton(this);
        status = new QLabel(this); status->setTextFormat(Qt::PlainText); status->setWordWrap(true);
        layout->addWidget(label); layout->addWidget(input); layout->addWidget(save); layout->addWidget(language); layout->addWidget(status);
        connect(language, &QPushButton::clicked, this, [this] { setIndonesian(!indonesian); });
        connect(save, &QPushButton::clicked, this, [this] {
            status->setText(QCoreApplication::translate("Lesson", "Draft: %1").arg(input->text()));
        });
        translateUi(); resize(480, 260);
    }
    ~LessonWindow() override { QCoreApplication::removeTranslator(&translator); }
    bool setIndonesian(bool enabled) {
        if (enabled == indonesian) return true;
        if (enabled) {
            if (!translator.load(":/i18n/lesson_id.qm")) { status->setText("Translation resource could not load."); return false; }
            QCoreApplication::installTranslator(&translator);
        } else QCoreApplication::removeTranslator(&translator);
        indonesian = enabled; translateUi(); return true;
    }
    void translateUi() {
        setWindowTitle(QCoreApplication::translate("Lesson", "Translated Qt form"));
        label->setText(QCoreApplication::translate("Lesson", "&Task title"));
        input->setAccessibleName(QCoreApplication::translate("Lesson", "Task title"));
        save->setText(QCoreApplication::translate("Lesson", "&Show draft"));
        language->setText(indonesian ? "English" : "Bahasa Indonesia");
        // The user's draft stays in the existing input; it is never translated.
    }
protected:
    void changeEvent(QEvent *event) override {
        if (event->type() == QEvent::LanguageChange) translateUi();
        QWidget::changeEvent(event);
    }
};
