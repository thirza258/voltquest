#pragma once
#include <QMainWindow>
#include <QPlainTextEdit>
#include <QTextDocument>
#include <QMenuBar>
#include <QStatusBar>
#include <QAction>
#include <QMessageBox>
#include <QCloseEvent>

class LessonWindow : public QMainWindow {
public:
    QPlainTextEdit *editor;
    QAction *newAction;
    LessonWindow() {
        setWindowTitle("In-memory notes[*]");
        editor = new QPlainTextEdit(this);
        editor->setAccessibleName("Note text");
        setCentralWidget(editor);
        auto *file = menuBar()->addMenu("&File");
        newAction = file->addAction("&New");
        newAction->setShortcut(QKeySequence::New);
        connect(newAction, &QAction::triggered, this, [this] {
            if (!canDiscard()) return;
            editor->clear(); editor->document()->setModified(false);
        });
        auto *about = menuBar()->addMenu("&Help")->addAction("&About");
        connect(about, &QAction::triggered, this, [this] {
            QMessageBox::information(this, "About", "This lesson keeps notes in memory. The file course adds persistence.");
        });
        connect(editor->document(), &QTextDocument::modificationChanged, this, &QWidget::setWindowModified);
        statusBar()->showMessage("In-memory editor; New and Close protect modified text.");
        resize(600, 420);
    }
    bool canDiscard() {
        if (!editor->document()->isModified()) return true;
        return QMessageBox::question(this, "Discard edits?", "Discard the current unsaved note?",
            QMessageBox::Discard | QMessageBox::Cancel, QMessageBox::Cancel) == QMessageBox::Discard;
    }
protected:
    void closeEvent(QCloseEvent *event) override {
        if (canDiscard()) event->accept(); else event->ignore();
    }
};
