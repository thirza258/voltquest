#pragma once
#include "ui_Form.h"
#include "Task.h"

class LessonWindow : public QWidget {
public:
    Ui::Form ui;
    LessonWindow() {
        ui.setupUi(this);
        resize(420, 240);
        connect(ui.saveButton, &QPushButton::clicked, this, [this] {
            const auto title = ui.titleInput->text();
            ui.statusLabel->setText(validTitle(title) ? "Saved draft: " + title.trimmed()
                : "Enter a nonempty title without control characters, up to 80 UTF-16 units.");
        });
    }
};
