migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  // 阶段性采用邮箱密码直接登录，不依赖 SMTP；不伪造邮箱已验证状态。
  users.authAlert.enabled = false;
  app.save(users);
});
