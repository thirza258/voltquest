/** Native Qt Test bodies, compiled from the same files delivered to learners. */
const rules = String.raw`
    void titleBoundaries() {
        QVERIFY(!validTitle("")); QVERIFY(!validTitle("   "));
        QVERIFY(validTitle(QString(80, 'x'))); QVERIFY(!validTitle(QString(81, 'x')));
        QVERIFY(!validTitle(QString("a\nb"))); QVERIFY(!validTitle(QString("a\tb")));
        QVERIFY(!validTitle(QString::fromUtf8("a\0b", 3)));
        QVERIFY(validTitle(QString::fromUtf8("Belajar Qt — café")));
    }
`
const models = String.raw`
    void modelContracts() {
        TaskModel model;
        QAbstractItemModelTester tester(&model, QAbstractItemModelTester::FailureReportingMode::QtTest);
        QSignalSpy changes(&model, &TaskModel::changed);
        QVERIFY(!model.add(" ")); QCOMPARE(changes.count(), 0);
        QVERIFY(model.add("  Alpha  ")); QCOMPARE(model.rowCount(), 1);
        const auto index = model.index(0); const auto id = model.data(index, Qt::UserRole).toString();
        QCOMPARE(model.data(index).toString(), QString("Alpha"));
        QVERIFY(!model.setData(index, "", Qt::EditRole)); QCOMPARE(changes.count(), 1);
        QVERIFY(model.setData(index, "Beta", Qt::EditRole));
        QCOMPARE(model.data(index, Qt::UserRole).toString(), id);
        QVERIFY(model.setData(index, Qt::Checked, Qt::CheckStateRole));
        QCOMPARE(model.data(index, Qt::CheckStateRole).toInt(), int(Qt::Checked));
        QVERIFY(!model.removeAt(-1)); QVERIFY(!model.removeAt(1));
        QCOMPARE(model.rowCount(index), 0);
        QVERIFY(model.removeAt(0)); QCOMPARE(model.rowCount(), 0);
        for (int i = 0; i < 100; ++i) QVERIFY(model.add(QString::number(i)));
        QVERIFY(!model.add("overflow")); QCOMPARE(model.rowCount(), 100);
    }
    void filteredSelection() {
        TaskEditor editor;
        QVERIFY(editor.model->add("Zebra")); QVERIFY(editor.model->add("Alpha")); QVERIFY(editor.model->add("Middle"));
        const auto firstId = editor.model->data(editor.model->index(0), Qt::UserRole);
        editor.search->setText("Middle"); QCOMPARE(editor.proxy->rowCount(), 1);
        editor.list->setCurrentIndex(editor.proxy->index(0, 0));
        QTest::mouseClick(editor.removeButton, Qt::LeftButton);
        QCOMPARE(editor.model->rowCount(), 2); QCOMPARE(editor.proxy->rowCount(), 0);
        QCOMPARE(editor.model->data(editor.model->index(0), Qt::UserRole), firstId);
        QCOMPARE(editor.model->data(editor.model->index(1)).toString(), QString("Alpha"));
        QTest::mouseClick(editor.removeButton, Qt::LeftButton); QCOMPARE(editor.model->rowCount(), 2);
    }
`
const files = String.raw`
    void fileRoundTrip() {
        QTemporaryDir directory; QVERIFY(directory.isValid());
        const auto path = directory.filePath("tasks.json"); QString error;
        QVector<Task> original{newTask(QString::fromUtf8("Café <literal>")), newTask("Review files")};
        original[1].done = true; QVERIFY(saveTasks(path, original, error));
        QFile saved(path); QVERIFY(saved.open(QIODevice::ReadOnly)); QCOMPARE(saved.readAll(), encodeTasks(original));
        QVector<Task> loaded; QVERIFY(loadTasks(path, loaded, error)); QCOMPARE(loaded.size(), 2);
        QCOMPARE(loaded[0].id, original[0].id); QCOMPARE(loaded[0].title, original[0].title); QVERIFY(loaded[1].done);
        QVERIFY(!saveTasks(directory.filePath("missing/tasks.json"), original, error)); QVERIFY(!error.isEmpty());
    }
    void rejectWholeDocument() {
        QVector<Task> kept{newTask("Keep me")}; const auto originalId = kept[0].id; QString error;
        const auto good = QJsonDocument::fromJson(encodeTasks(kept)).object();
        QVector<QByteArray> bad{QByteArray("{"), QByteArray("[]"), QByteArray(65537, 'x')};
        auto version = good; version["version"] = 2; bad.push_back(QJsonDocument(version).toJson());
        version["version"] = 1.5; bad.push_back(QJsonDocument(version).toJson());
        auto item = good["tasks"].toArray()[0].toObject();
        auto duplicate = good; duplicate["tasks"] = QJsonArray{item, item}; bad.push_back(QJsonDocument(duplicate).toJson());
        item["done"] = "false"; auto wrongType = good; wrongType["tasks"] = QJsonArray{item}; bad.push_back(QJsonDocument(wrongType).toJson());
        item = good["tasks"].toArray()[0].toObject(); item["title"] = QString::fromUtf8("a\0b", 3);
        wrongType["tasks"] = QJsonArray{item}; bad.push_back(QJsonDocument(wrongType).toJson());
        QVector<Task> tooMany; for (int i = 0; i < 101; ++i) tooMany.push_back(newTask("Task"));
        bad.push_back(encodeTasks(tooMany));
        for (const auto &bytes : bad) { QVERIFY(!decodeTasks(bytes, kept, error)); QCOMPARE(kept.size(), 1); QCOMPARE(kept[0].id, originalId); }
    }
    void notebookPersistence() {
        QTemporaryDir directory; QVERIFY(directory.isValid());
        LessonWindow window; QVERIFY(window.editor->model->add("Saved task")); QVERIFY(window.dirty);
        const auto path = directory.filePath("notebook.json"); QVERIFY(window.saveTo(path)); QVERIFY(!window.dirty);
        const auto id = window.editor->model->snapshot()[0].id;
        QVERIFY(window.editor->model->add("Unsaved task"));
        QVERIFY(!window.saveTo(directory.filePath("missing/file.json"))); QVERIFY(window.dirty); QCOMPARE(window.currentPath, path);
        QFile corrupt(directory.filePath("bad.json")); QVERIFY(corrupt.open(QIODevice::WriteOnly)); corrupt.write("{"); corrupt.close();
        QVERIFY(!window.loadFrom(corrupt.fileName())); QCOMPARE(window.editor->model->rowCount(), 2); QVERIFY(window.dirty);
        QVERIFY(window.loadFrom(path)); QCOMPARE(window.editor->model->rowCount(), 1); QVERIFY(!window.dirty);
        QCOMPARE(window.editor->model->snapshot()[0].id, id);
    }
`
const draft = String.raw`
    void cancelledCloseKeepsDraft() {
        LessonWindow window; window.show(); window.editor->input->setText("Unadded work"); QVERIFY(!window.dirty);
        QTimer::singleShot(0, [] {
            auto *box = qobject_cast<QMessageBox*>(QApplication::activeModalWidget());
            QVERIFY(box); box->done(QMessageBox::Cancel);
        });
        QVERIFY(!window.close()); QVERIFY(window.isVisible()); QCOMPARE(window.editor->input->text(), QString("Unadded work"));
        window.editor->input->clear(); QVERIFY(window.close());
    }
`
export const QT_TEST_CASES = {
  start: String.raw`
    void actualClicks() {
        LessonWindow window; window.show(); QCOMPARE(window.label->text(), QString("Clicks: 0"));
        for (int i = 0; i < 3; ++i) QTest::mouseClick(window.button, Qt::LeftButton);
        QCOMPARE(window.label->text(), QString("Clicks: 3")); QCOMPARE(window.count, 3);
    }
`,
  cpp: String.raw`
    void signalsAndLifetime() {
        LessonWindow window; QSignalSpy spy(window.controller, &CounterController::countChanged);
        QTest::mouseClick(window.button, Qt::LeftButton); QTest::mouseClick(window.button, Qt::LeftButton);
        QCOMPARE(spy.count(), 2); QCOMPARE(spy.at(1).at(0).toInt(), 2); QCOMPARE(window.label->text(), QString("Count: 2"));
        int calls = 0;
        { QObject context; QObject::connect(window.controller, &CounterController::countChanged, &context, [&calls] { ++calls; }); window.controller->increment(); }
        window.controller->increment(); QCOMPARE(calls, 1);
        QPointer<CounterController> observer;
        { QObject parent; observer = new CounterController(&parent); QVERIFY(observer); }
        QVERIFY(observer.isNull());
    }
`,
  layout: rules + String.raw`
    void generatedFormInteraction() {
        LessonWindow window; window.show();
        QCOMPARE(window.ui.titleLabel->buddy(), window.ui.titleInput);
        window.ui.titleInput->setText(" "); QTest::mouseClick(window.ui.saveButton, Qt::LeftButton);
        QVERIFY(window.ui.statusLabel->text().startsWith("Enter a nonempty")); QCOMPARE(window.ui.titleInput->text(), QString(" "));
        window.ui.titleInput->setText("<b>literal</b>"); QTest::mouseClick(window.ui.saveButton, Qt::LeftButton);
        QCOMPARE(window.ui.statusLabel->text(), QString("Saved draft: <b>literal</b>"));
        QCOMPARE(window.ui.statusLabel->textFormat(), Qt::PlainText);
    }
`,
  events: rules + String.raw`
    void mouseAndKeyboardUseSameRules() {
        LessonWindow window; window.show();
        window.input->setText("   "); QTest::mouseClick(window.addButton, Qt::LeftButton);
        QCOMPARE(window.model->rowCount(), 0); QCOMPARE(window.input->text(), QString("   "));
        window.input->setText("Buy bread"); QTest::mouseClick(window.addButton, Qt::LeftButton);
        QCOMPARE(window.model->rowCount(), 1); QVERIFY(window.input->text().isEmpty());
        window.input->setText("Review C++"); QTest::keyClick(window.input, Qt::Key_Return);
        QCOMPARE(window.model->rowCount(), 2);
        QVERIFY(!window.model->setData(window.model->index(0), "", Qt::EditRole));
        QCOMPARE(window.model->data(window.model->index(0)).toString(), QString("Buy bread"));
    }
`,
  mainwindow: String.raw`
    void cancelAndDiscard() {
        LessonWindow window; window.show(); QTest::keyClicks(window.editor, "Keep my note");
        QVERIFY(window.editor->document()->isModified());
        QTimer::singleShot(0, [] { auto *box = qobject_cast<QMessageBox*>(QApplication::activeModalWidget()); QVERIFY(box); box->done(QMessageBox::Cancel); });
        window.newAction->trigger(); QCOMPARE(window.editor->toPlainText(), QString("Keep my note")); QVERIFY(window.isWindowModified());
        QTimer::singleShot(0, [] { auto *box = qobject_cast<QMessageBox*>(QApplication::activeModalWidget()); QVERIFY(box); box->done(QMessageBox::Discard); });
        window.newAction->trigger(); QVERIFY(window.editor->toPlainText().isEmpty()); QVERIFY(!window.editor->document()->isModified());
    }
`,
  models: rules + models,
  files: rules + files,
  sql: rules + String.raw`
    void repositoryRoundTrip() {
        QTemporaryDir directory; QVERIFY(directory.isValid()); const auto path = directory.filePath("test.sqlite");
        qint64 id = 0;
        { SqlTasks repo; QVERIFY(repo.open(path)); QVERIFY(!repo.add(" "));
          QVERIFY(repo.add("Sam's task'); DROP TABLE tasks;--")); QVector<SqlTask> rows; QVERIFY(repo.all(rows)); QCOMPARE(rows.size(), 1);
          QCOMPARE(rows[0].title, QString("Sam's task'); DROP TABLE tasks;--")); id = rows[0].id;
          QVERIFY(repo.mutate(id, false)); QVERIFY(!repo.mutate(id + 100, false)); }
        { SqlTasks repo; QVERIFY(repo.open(path)); QVector<SqlTask> rows; QVERIFY(repo.all(rows)); QCOMPARE(rows[0].id, id); QVERIFY(rows[0].done);
          QVERIFY(repo.mutate(id, true)); QVERIFY(repo.all(rows)); QVERIFY(rows.isEmpty()); }
    }
    void unknownSchemaAndRollback() {
        QTemporaryDir directory; const auto path = directory.filePath("future.sqlite");
        { auto db = QSqlDatabase::addDatabase("QSQLITE", "future-fixture"); db.setDatabaseName(path); QVERIFY(db.open());
          { QSqlQuery q(db); QVERIFY(q.exec("PRAGMA user_version=9")); } db.close(); }
        QSqlDatabase::removeDatabase("future-fixture");
        SqlTasks future; QVERIFY(!future.open(path)); QVERIFY(future.error.contains("Unsupported"));
        const auto rollbackPath = directory.filePath("rollback.sqlite"); SqlTasks repo; QVERIFY(repo.open(rollbackPath)); QVERIFY(repo.add("Keep"));
        { auto db = QSqlDatabase::addDatabase("QSQLITE", "rollback-fixture"); db.setDatabaseName(rollbackPath); QVERIFY(db.open());
          { QSqlQuery q(db); QVERIFY(q.exec("CREATE TRIGGER reject_insert BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT, 'test failure'); END")); } db.close(); }
        QSqlDatabase::removeDatabase("rollback-fixture");
        QVERIFY(!repo.add("Rejected")); QVector<SqlTask> rows; QVERIFY(repo.all(rows)); QCOMPARE(rows.size(), 1); QCOMPARE(rows[0].title, QString("Keep"));
    }
    void databaseControls() {
        QTemporaryDir directory; LessonWindow window(directory.filePath("ui.sqlite"));
        window.input->setText("From UI"); QTest::mouseClick(window.addButton, Qt::LeftButton);
        QCOMPARE(window.list->count(), 1); QVERIFY(window.input->text().isEmpty());
    }
`,
  network: String.raw`
    void realLoopbackReplies_data() {
        QTest::addColumn<QByteArray>("body"); QTest::addColumn<int>("status"); QTest::addColumn<bool>("ok");
        QTest::newRow("valid") << QByteArray("{\"message\":\"Hello fixture\"}") << 200 << true;
        QTest::newRow("malformed") << QByteArray("{") << 200 << false;
        QTest::newRow("wrong-type") << QByteArray("{\"message\":17}") << 200 << false;
        QTest::newRow("http-error") << QByteArray("{\"message\":\"Missing\"}") << 404 << false;
        QTest::newRow("oversized") << QByteArray(5000, 'x') << 200 << false;
        QTest::newRow("redirect") << QByteArray("{}") << 302 << false;
    }
    void realLoopbackReplies() {
        QFETCH(QByteArray, body); QFETCH(int, status); QFETCH(bool, ok);
        QTcpServer server; QVERIFY(server.listen(QHostAddress::LocalHost, 0));
        connect(&server, &QTcpServer::newConnection, &server, [&server, body, status] {
            auto *socket = server.nextPendingConnection();
            connect(socket, &QTcpSocket::readyRead, socket, [socket, body, status] {
                if (socket->property("sent").toBool()) return;
                socket->readAll(); socket->setProperty("sent", true);
                socket->write("HTTP/1.1 " + QByteArray::number(status) + " Test\r\nContent-Type: application/json\r\nContent-Length: " + QByteArray::number(body.size()) + "\r\nConnection: close\r\n\r\n" + body);
                socket->disconnectFromHost();
            });
        });
        NetworkClient client; QSignalSpy spy(&client, &NetworkClient::settled);
        QVERIFY(client.fetch(QUrl(QString("http://127.0.0.1:%1/tasks").arg(server.serverPort()))));
        QVERIFY(!client.fetch()); QTRY_COMPARE(spy.count(), 1); QCOMPARE(spy.at(0).at(0).toBool(), ok);
        if (ok) QCOMPARE(spy.at(0).at(1).toString(), QString("Hello fixture")); QVERIFY(!client.busy());
    }
    void timeoutCancelAndConnectionFailure() {
        QTcpServer server; QVERIFY(server.listen(QHostAddress::LocalHost, 0));
        const QUrl url(QString("http://127.0.0.1:%1/tasks").arg(server.serverPort()));
        NetworkClient client; QSignalSpy spy(&client, &NetworkClient::settled);
        QVERIFY(client.fetch(url, 30)); QTRY_COMPARE(spy.count(), 1); QVERIFY(spy.at(0).at(1).toString().contains("timed out"));
        spy.clear(); QVERIFY(client.fetch(url)); client.cancel(); QTRY_COMPARE(spy.count(), 1); QVERIFY(spy.at(0).at(1).toString().contains("cancelled"));
        spy.clear(); server.close(); QVERIFY(client.fetch(url)); QTRY_COMPARE(spy.count(), 1); QVERIFY(!spy.at(0).at(0).toBool());
    }
`,
  async: String.raw`
    void referenceArithmeticAndCancellation() {
        auto token = std::make_shared<std::atomic_bool>(false);
        for (int n : {1, 2, 1000, 20000}) { const auto result = sumNumbers(n, token); QVERIFY(!result.cancelled); QCOMPARE(result.sum, quint64(n) * quint64(n + 1) / 2); }
        token->store(true); QVERIFY(sumNumbers(100000000, token).cancelled);
    }
    void guiCompletionAndClosing() {
        LessonWindow window; window.show(); QTest::mouseClick(window.start, Qt::LeftButton);
        QTRY_COMPARE(window.status->text(), QString("Sum: 500500")); QVERIFY(window.start->isEnabled()); QVERIFY(!window.cancel->isEnabled());
        { LessonWindow closing; closing.limit->setValue(100000000); closing.start->click(); }
        QVERIFY(QThreadPool::globalInstance()->waitForDone(5000));
    }
`,
  graphics: String.raw`
    void valuesAndActualPixels() {
        LessonWindow window; window.slider->setValue(25); QCOMPARE(window.label->text(), QString("Progress: 25%"));
        for (int width : {320, 640}) {
            window.view->resize(width, 120); window.view->setValue(25);
            QImage image(window.view->size(), QImage::Format_ARGB32); image.fill(Qt::transparent); window.view->render(&image);
            QCOMPARE(image.pixelColor(20, 60), QColor("#0d9488")); QCOMPARE(image.pixelColor(width - 20, 60), QColor("#e2e8f0"));
            const int boundary = 16 + (width - 32) / 4;
            QCOMPARE(image.pixelColor(boundary - 2, 60), QColor("#0d9488")); QCOMPARE(image.pixelColor(boundary + 2, 60), QColor("#e2e8f0"));
        }
        window.view->setValue(-1); QCOMPARE(window.view->value, 0); window.view->setValue(101); QCOMPARE(window.view->value, 100);
    }
`,
  qml: String.raw`
    void nativeQmlBindings() {
        QQmlApplicationEngine engine; engine.loadFromModule("VoltQuest.Lesson", "Main");
        QCOMPARE(engine.rootObjects().size(), 1); auto *root = engine.rootObjects().first();
        auto *counter = root->findChild<QObject*>("counter"); auto *label = root->findChild<QObject*>("countLabel");
        auto *button = root->findChild<QObject*>("incrementButton"); QVERIFY(counter); QVERIFY(label); QVERIFY(button);
        QCOMPARE(label->property("text").toString(), QString("Count: 0"));
        QVERIFY(QMetaObject::invokeMethod(button, "clicked")); QVERIFY(QMetaObject::invokeMethod(counter, "increment"));
        QTRY_COMPARE(label->property("text").toString(), QString("Count: 2"));
        QCOMPARE(counter->property("count").toInt(), 2);
    }
`,
  localization: String.raw`
    void compiledTranslationPreservesDraft() {
        LessonWindow window; window.input->setText(QString::fromUtf8("Café <unfinished>"));
        QVERIFY(window.setIndonesian(true)); QCOMPARE(window.label->text(), QString("&Judul tugas"));
        QCOMPARE(window.input->accessibleName(), QString("Judul tugas")); QCOMPARE(window.label->buddy(), window.input);
        QCOMPARE(window.input->text(), QString::fromUtf8("Café <unfinished>"));
        QTest::mouseClick(window.save, Qt::LeftButton); QCOMPARE(window.status->text(), QString::fromUtf8("Draf: Café <unfinished>"));
        QVERIFY(window.setIndonesian(false)); QCOMPARE(window.label->text(), QString("&Task title"));
        QCOMPARE(window.input->text(), QString::fromUtf8("Café <unfinished>"));
    }
`,
  testing: rules + models + files + draft,
  deployment: String.raw`
    void embeddedResourceIndependentOfDirectory() {
        const auto before = QDir::currentPath(); QTemporaryDir directory; QVERIFY(QDir::setCurrent(directory.path()));
        LessonWindow window; QVERIFY(window.label->text().contains("VoltQuest Qt desktop lesson resource."));
        QVERIFY(window.label->text().contains("does not depend on the current working directory"));
        QVERIFY(QDir::setCurrent(before));
    }
`,
  capstone: rules + models + files + draft,
}
