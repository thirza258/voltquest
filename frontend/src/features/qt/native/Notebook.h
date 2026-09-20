#pragma once
#include "TaskEditor.h"
#include "TaskFile.h"
#include <QMainWindow>
#include <QMenuBar>
#include <QAction>
#include <QFileDialog>
#include <QMessageBox>
#include <QCloseEvent>
#include <QSettings>

class Notebook : public QMainWindow {
public:
    TaskEditor *editor;
    QString currentPath;
    bool dirty = false;
    Notebook() {
        setWindowTitle("Qt task notebook[*]");
        editor = new TaskEditor(this); setCentralWidget(editor);
        connect(editor->model, &TaskModel::changed, this, [this] { markDirty(true); });
        auto *file = menuBar()->addMenu("&File");
        auto *fresh = file->addAction("&New"); fresh->setShortcut(QKeySequence::New);
        auto *open = file->addAction("&Open…"); open->setShortcut(QKeySequence::Open);
        auto *save = file->addAction("&Save"); save->setShortcut(QKeySequence::Save);
        auto *saveAs = file->addAction("Save &As…"); saveAs->setShortcut(QKeySequence::SaveAs);
        connect(fresh, &QAction::triggered, this, [this] {
            if (!canDiscard()) return;
            editor->model->replace({}); editor->input->clear(); editor->search->clear();
            currentPath.clear(); markDirty(false); editor->status->setText("New document.");
        });
        connect(open, &QAction::triggered, this, [this] {
            if (!canDiscard()) return;
            const auto path = QFileDialog::getOpenFileName(this, "Open tasks", {}, "Task JSON (*.json)");
            if (!path.isEmpty()) loadFrom(path);
        });
        connect(save, &QAction::triggered, this, [this] { saveDocument(false); });
        connect(saveAs, &QAction::triggered, this, [this] { saveDocument(true); });
        resize(640, 520);
        QSettings settings;
        restoreGeometry(settings.value("geometry").toByteArray());
    }
    void markDirty(bool value) { dirty = value; setWindowModified(value); }
    bool hasUnsaved() const { return dirty || !editor->input->text().isEmpty(); }
    bool canDiscard() {
        if (!hasUnsaved()) return true;
        return QMessageBox::question(this, "Discard current work?", "Discard unsaved task changes and the current input draft?",
            QMessageBox::Discard | QMessageBox::Cancel, QMessageBox::Cancel) == QMessageBox::Discard;
    }
    bool saveTo(const QString &path) {
        QString error;
        if (!saveTasks(path, editor->model->snapshot(), error)) { editor->status->setText("Save failed: " + error); return false; }
        currentPath = path; markDirty(false);
        editor->status->setText("Saved accepted tasks to " + path + ". Unadded input is not in the file.");
        return true;
    }
    bool loadFrom(const QString &path) {
        QVector<Task> candidate;
        QString error;
        if (!loadTasks(path, candidate, error)) { editor->status->setText("Open failed: " + error); return false; }
        if (!editor->model->replace(candidate)) { editor->status->setText("Model rejected the document."); return false; }
        editor->input->clear(); editor->search->clear();
        currentPath = path; markDirty(false); editor->status->setText("Opened " + path);
        return true;
    }
    void saveDocument(bool choosePath) {
        const auto path = choosePath || currentPath.isEmpty()
            ? QFileDialog::getSaveFileName(this, "Save accepted tasks", currentPath, "Task JSON (*.json)") : currentPath;
        if (!path.isEmpty()) saveTo(path);
    }
protected:
    void closeEvent(QCloseEvent *event) override {
        if (!canDiscard()) { event->ignore(); return; }
        QSettings settings; settings.setValue("geometry", saveGeometry());
        event->accept();
    }
};
