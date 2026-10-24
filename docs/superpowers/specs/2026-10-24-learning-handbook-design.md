# 海岸学习手册

用户要求美化 /learning/，延续此前自行判断、先方案审阅再实施发布的授权。基线 a0970ef，354项测试。仅指定 clock-lyrics-widget worktree 修改。原 dirty task-4-report.md 保留。

## 设计决定

考量纯配色微调、星图重建、海岸学习手册三种方向。纯配色不足以改善导航，星图增加视觉负担且超出本次美化范围，选择海岸学习手册。与研究作品集使用一致纸白/深海色，但学习页强调目录效率而非项目展览。

首屏改为两栏：左侧原有标题、导语和一个“浏览学习目录”原生锚点；右侧使用现有 coast-background.png 作为纯装饰氛围，不能引入新图片或生成虚构图。保留原标题和导语。原大面积深遮罩取消，文字在纯底上清晰可读。小标签 PYTORCH / STUDY NOTES，不声称学习进度或完成百分比。宽屏首屏约280–340px高，不能把文章入口推到很远。

目录保留左侧八个原有学习路线/阶段入口，宽屏280px侧栏，右侧文章列表。侧栏是精确编号的目录，按钮和“进入阶段”链接视觉分层，当前阶段以底色、左边线、字重和 aria-pressed共同表达。CSS counter编号不伪造数据。右侧标题/真实篇数/进入此阶段动作成为清楚的阅读区头部；文章为整行可点的编号列表，细分隔线，留白而非多层嵌套卡片。所有标题保持原文，不新增描述、关系、笔记数量或进度数据。

<=900px目录在文章区上方，阶段入口网格两列；<=480px仍两列，每格允许自然换行，单列降级只在真实宽度不足时。按钮与直达链接均>=44px，不靠横向滚动才能发现后续阶段。桌面侧栏可以sticky但须max-height和内部滚动保障低高度可达。原生无JS阶段链接必须保留；JSON失败时状态与直达链接仍可用。

## 实现边界

只改 learning/index.html，新增 assets/learning-handbook.css、tests/learning-handbook.test.mjs，必要更新原布局断言。新body类 learning-handbook，CSS所有选择器限定此类，最后加载。不得修改 assets/learning-directory.js、reading-theme.js、共享CSS、learning/pytorch/**、research/**、首页、生活页。所有 data-directory-*、data-learning-directory、data-relations-url契约保持，动态数据仍来自现有真实关系JSON。无新JS、依赖、动画、字体、后端。日间 #f5f3ee/#203136、夜间 #101b22/#edf2ef；muted/链接文字对比>=4.5。使用系统中文和Georgia标题。背景图片失败有纯色回退；装饰图片不重复朗读。

## 验收和发布

独立实现agent RED/GREEN commit，独立reviewer；必要修复agent与复审；最终独立全分支审阅。测试不少于354，相关JS syntax、实际笔记同步 --check、diff --check；数据脚本/笔记/研究页和首页与基线逐字相同。浏览器1440×900、1024×768、720×900、320×568昼夜，八阶段切换与真实文章数量、Enter/Space、原生直达、低高度导航、JSON失败/图片失败、主题持久化。真实触摸及OS reduced-motion模拟不可用时明确仅规则检查。最终审阅批准后fast-forward master并推送，核对SHA与线上资源。
