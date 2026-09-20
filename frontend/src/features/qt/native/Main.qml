import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import VoltQuest.Lesson

ApplicationWindow {
    id: window
    visible: true
    width: 500
    height: 280
    minimumWidth: 280
    minimumHeight: 200
    title: "Qt Quick with C++"
    CounterBackend { id: counter; objectName: "counter" }
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        Label {
            objectName: "countLabel"
            text: "Count: " + counter.count
            Layout.fillWidth: true
            font.pixelSize: 24
        }
        Button {
            objectName: "incrementButton"
            text: "Increment"
            Accessible.name: "Increment count"
            onClicked: counter.increment()
        }
        Item { Layout.fillHeight: true }
    }
}
