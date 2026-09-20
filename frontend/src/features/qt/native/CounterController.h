#pragma once
#include <QObject>

class CounterController : public QObject {
    Q_OBJECT
public:
    using QObject::QObject;
    int count() const { return value; }
    void increment() { emit countChanged(++value); }
signals:
    void countChanged(int count);
private:
    int value = 0;
};
