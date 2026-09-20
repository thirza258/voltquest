#pragma once
#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QPointer>
#include <QTimer>
#include <QJsonDocument>
#include <QJsonObject>

class NetworkClient : public QObject {
    Q_OBJECT
    QNetworkAccessManager manager;
    QPointer<QNetworkReply> active;
    QByteArray received;
    QString reason;
public:
    explicit NetworkClient(QObject *parent = nullptr) : QObject(parent), manager(this) {}
    bool busy() const { return !active.isNull(); }
    bool fetch(const QUrl &url = QUrl("http://127.0.0.1:8765/tasks"), int deadlineMs = 2000) {
        if (busy()) return false;
        // This lesson's transport is explicitly a local, fixed-host fixture.
        if (url.scheme() != "http" || url.host() != "127.0.0.1" || !url.userInfo().isEmpty()) {
            emit settled(false, "Only the local loopback fixture is supported."); return false;
        }
        received.clear(); reason.clear();
        QNetworkRequest request(url);
        request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::ManualRedirectPolicy);
        auto *reply = manager.get(request); active = reply;
        reply->setReadBufferSize(4097);
        auto *deadline = new QTimer(reply); deadline->setSingleShot(true);
        connect(deadline, &QTimer::timeout, this, [this, reply] { reason = "Request timed out."; reply->abort(); });
        deadline->start(qBound(1, deadlineMs, 10000));
        connect(reply, &QIODevice::readyRead, this, [this, reply] { consume(reply); });
        connect(reply, &QNetworkReply::finished, this, [this, reply, deadline] {
            deadline->stop(); consume(reply);
            QString message = reason;
            const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
            if (message.isEmpty() && reply->error() != QNetworkReply::NoError) message = reply->errorString();
            if (message.isEmpty() && status != 200) message = "Expected HTTP 200.";
            QJsonParseError parse;
            const auto document = QJsonDocument::fromJson(received, &parse);
            const auto value = document.object().value("message");
            if (message.isEmpty() && (parse.error != QJsonParseError::NoError || !document.isObject()
                || !value.isString() || value.toString().size() > 200)) message = "Invalid response schema.";
            const bool ok = message.isEmpty();
            if (ok) message = value.toString();
            active.clear(); reply->deleteLater();
            emit settled(ok, message);
        });
        return true;
    }
    void cancel() { if (active) { reason = "Request cancelled."; active->abort(); } }
signals:
    void settled(bool ok, const QString &message);
private:
    void consume(QNetworkReply *reply) {
        if (!reply->isOpen() || !reason.isEmpty()) return;
        received += reply->read(qMax<qint64>(0, 4097 - received.size()));
        if (received.size() > 4096) { reason = "Response exceeds 4096 bytes."; reply->abort(); }
    }
};
