#pragma once
#include <QWidget>
#include <QPainter>
#include <QSlider>
#include <QLabel>
#include <QVBoxLayout>

class ProgressView : public QWidget {
public:
    int value = 0;
    explicit ProgressView(QWidget *parent = nullptr) : QWidget(parent) { setMinimumSize(120, 80); }
    void setValue(int next) { value = qBound(0, next, 100); update(); }
protected:
    void paintEvent(QPaintEvent *) override {
        QPainter painter(this);
        painter.fillRect(rect(), QColor("#ffffff"));
        const QRectF track(16, height() / 2.0 - 12, qMax(0, width() - 32), 24);
        painter.fillRect(track, QColor("#e2e8f0"));
        QRectF filled = track; filled.setWidth(track.width() * value / 100.0);
        painter.fillRect(filled, QColor("#0d9488"));
    }
};
class LessonWindow : public QWidget {
public:
    ProgressView *view;
    QSlider *slider;
    QLabel *label;
    LessonWindow() {
        setWindowTitle("Qt custom painting");
        auto *layout = new QVBoxLayout(this);
        view = new ProgressView(this);
        slider = new QSlider(Qt::Horizontal, this); slider->setRange(0, 100); slider->setAccessibleName("Progress percentage");
        label = new QLabel("Progress: 0%", this);
        layout->addWidget(label); layout->addWidget(view); layout->addWidget(slider);
        connect(slider, &QSlider::valueChanged, view, &ProgressView::setValue);
        connect(slider, &QSlider::valueChanged, this, [this](int value) {
            label->setText(QString("Progress: %1%").arg(value));
        });
        resize(500, 240);
    }
};
