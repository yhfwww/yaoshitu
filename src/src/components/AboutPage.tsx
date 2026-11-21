import { useState } from "react";
import { AuxiliaryPage } from "./AuxiliaryPage";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

const EMAIL = "yhfwww@gmail.com";

export function AboutPage({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AuxiliaryPage title="关于要事图" description="要事一图，轻重自现。" onClose={onClose}>
      <div className="about-content">
        <div className="about-hero">
          <Logo size={72} />
          <div>
            <h1>要事图 / Yaoshitu</h1>
            <p>把要事放进一张图里。</p>
          </div>
        </div>

        <section className="about-section">
          <h2>产品理念</h2>
          <p>要事图是本地优先的坐标系任务管理器。用连续的紧急度和重要度表达差异，让优先级不是四选一，而是一眼可见的相对位置。</p>
          <p>任务首先保存在你的浏览器中；你可以按自己的节奏备份，并在需要时登录使用跨设备同步。</p>
        </section>

        <section className="about-section">
          <h2>作者与联系</h2>
          <dl className="about-contact">
            <div><dt>作者</dt><dd>yhfwww</dd></div>
            <div><dt>邮箱</dt><dd>{EMAIL}</dd></div>
          </dl>
          <div className="about-actions">
            <a className="btn btn-primary" href={`mailto:${EMAIL}`}>
              <Icon name="mail" size={16} />
              写邮件
            </a>
            <button className="btn" onClick={() => void copyEmail()}>
              <Icon name="copy" size={16} />
              {copied ? "已复制邮箱" : "复制邮箱"}
            </button>
          </div>
        </section>

        <div className="about-version">当前版本 · v0.2.0-dev</div>
      </div>
    </AuxiliaryPage>
  );
}
