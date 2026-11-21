import { AuxiliaryPage } from "./AuxiliaryPage";

interface DocSection {
  id: string;
  title: string;
  intro: string;
  points: string[];
}

const SECTIONS: DocSection[] = [
  {
    id: "start",
    title: "开始使用",
    intro: "先创建一个任务，再用坐标表达你对它的判断。",
    points: [
      "点击侧栏的“新建任务”，填写标题；截止日期和标签可按需补充。",
      "在坐标系中拖动任务点：越向右代表越紧急，越向上代表越重要。",
      "不想拖动时可使用列表视图，它提供同一批任务的无障碍操作入口。",
    ],
  },
  {
    id: "coordinates",
    title: "理解坐标",
    intro: "要事图不把任务限定在四个格子里，而是使用连续的紧急度与重要度。",
    points: [
      "紧急度和重要度均为 1–100；相近的任务也能表达出先后差异。",
      "象限矩阵以 50 为阈值展示同一份坐标数据，不会产生第二份任务。",
      "坐标是判断工具，不是绩效打分；可以随着实际情况随时调整。",
    ],
  },
  {
    id: "views",
    title: "选择合适的视图",
    intro: "所有视图读写同一份本地数据，只是观察任务的角度不同。",
    points: [
      "坐标系用于排优先级；象限矩阵适合熟悉四象限方法时快速浏览。",
      "列表是批量操作、键盘和读屏使用的主通道；仪表盘用于回顾趋势。",
      "智能视图会按热点、即将逾期、可委派、该消除和标签等条件筛选任务。",
      "工作方式用于记录原则笔记；归档集中管理回收站和永久归档内容。",
    ],
  },
  {
    id: "lifecycle",
    title: "任务如何流转",
    intro: "删除不是立即消失，而是先进入结构化回收站。",
    points: [
      "完成的任务不再显示在坐标系中，但仍可在列表与归档中追溯。",
      "删除的任务会保留在回收站 30 天，可恢复或永久清除。",
      "归档适合不再参与日常排序、但仍想长期保留的任务。",
    ],
  },
  {
    id: "backup",
    title: "数据与备份",
    intro: "你的任务首先保存在当前浏览器的本地数据库中。",
    points: [
      "在设置页可导出 JSON 备份，也可导入已有备份。",
      "换设备、清理浏览器数据或进行重大调整前，请先导出备份。",
      "本地优先不等于永不丢失：备份是你掌握数据可移植性的方式。",
    ],
  },
  {
    id: "sync",
    title: "账号与同步",
    intro: "游客模式可离线使用；登录后可使用独立账号空间和跨设备同步。",
    points: [
      "游客数据与账号数据隔离；首次登录时可按提示决定是否迁移本机数据。",
      "同步状态会显示在侧栏底部，离线修改会进入待同步队列。",
      "同步用于多设备一致，不替代 JSON 备份；重要数据仍建议定期导出。",
    ],
  },
];

export function HelpDocsPage({ onClose }: { onClose: () => void }) {
  function jumpTo(id: string) {
    document.getElementById(`docs-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AuxiliaryPage title="帮助与文档" description="从第一条任务开始，了解要事图已经具备的能力。" onClose={onClose}>
      <div className="docs-layout">
        <nav className="docs-toc" aria-label="文档目录">
          <div className="docs-toc-title">目录</div>
          {SECTIONS.map((section, index) => (
            <button key={section.id} onClick={() => jumpTo(section.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </button>
          ))}
        </nav>
        <article className="docs-content">
          <div className="docs-lede">
            <p>要事图用连续坐标帮助你看清轻重缓急，而不是把任务强行塞进四个格子。</p>
            <p>本页只记录当前已经可以使用的功能；功能上线后，文档会与应用一起更新。</p>
          </div>
          {SECTIONS.map((section, index) => (
            <section key={section.id} id={`docs-${section.id}`} className="docs-section">
              <div className="docs-section-index">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h2>{section.title}</h2>
                <p>{section.intro}</p>
                <ul>
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            </section>
          ))}
        </article>
      </div>
    </AuxiliaryPage>
  );
}
