#pragma once
#include <QObject>
#include <QtQml/qqmlregistration.h>

class CounterBackend : public QObject {
    Q_OBJECT
    QML_ELEMENT
    Q_PROPERTY(int count READ count NOTIFY countChanged)
public:
    using QObject::QObject;
    int count() const { return value; }
    Q_INVOKABLE void increment() { ++value; emit countChanged(); }
signals:
    void countChanged();
private:
    int value = 0;
};
