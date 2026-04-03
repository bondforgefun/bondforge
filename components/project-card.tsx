import Link from 'next/link'
import { ProjectView } from '@/lib/bondforge/types'
import { shortenAddress } from '@/lib/web3/client'

export function ProjectCard({ project }: { project: ProjectView }) {
  return (
    <Link href={`/projects/${project.launchAddress}`} className="glass card project-card-shell block transition-transform hover:-translate-y-1">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <img
            src={project.imageUri || '/images/project-placeholder.svg'}
            alt={project.name}
            className="h-20 w-20 rounded-[22px] border border-white/10 object-cover"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold">{project.name}</h3>
              <span className="pill px-3 py-1 text-xs">{project.finalized ? '已发射' : '认购中'}</span>
            </div>
            <p className="muted mt-2 text-sm">{project.symbol} · 发射地址 {shortenAddress(project.launchAddress)}</p>
            <p className="muted mt-4 max-w-2xl text-sm leading-7">
              {project.description || '项目简介暂未补充完整，进入详情页后仍可查看池子状态、合约地址以及 NFT / Token 数据。'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {project.website ? <span className="pill px-3 py-2">官网</span> : null}
              {project.twitter ? <span className="pill px-3 py-2">X</span> : null}
              {project.telegram ? <span className="pill px-3 py-2">社群</span> : null}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          <div className="stat-tile">
            <div className="muted text-xs uppercase tracking-[0.18em]">认购单价</div>
            <div className="mt-3 text-lg font-semibold">{project.mintPriceLabel}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-xs uppercase tracking-[0.18em]">募资进度</div>
            <div className="mt-3 text-lg font-semibold">{project.progressLabel}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-xs uppercase tracking-[0.18em]">Token</div>
            <div className="mt-3 text-lg font-semibold">{shortenAddress(project.tokenAddress)}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-xs uppercase tracking-[0.18em]">NFT</div>
            <div className="mt-3 text-lg font-semibold">{shortenAddress(project.nftAddress)}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
