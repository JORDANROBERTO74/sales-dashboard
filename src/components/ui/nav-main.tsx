"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
    items,
}: {
    items: {
        key: string
        title: string
        url: string
        icon?: LucideIcon
        isActive?: boolean
        items?: {
            key: string
            title: string
            url: string
        }[]
    }[]
}) {
    const pathname = usePathname()
    const { state } = useSidebar()

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const hasSubItems = (item.items?.length ?? 0) > 0
                    const hasActiveSubItem =
                        item.items?.some((subItem) => pathname === subItem.url) ?? false
                    const isItemActive = pathname === item.url
                    const firstSubItemUrl = item.items?.[0]?.url
                    const shouldNavigateToFirstSubItem =
                        state === "collapsed" && Boolean(firstSubItemUrl)

                    if (!hasSubItems) {
                        return (
                            <SidebarMenuItem key={item.key}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    isActive={isItemActive}
                                >
                                    <Link href={item.url}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )
                    }

                    return (
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.isActive || hasActiveSubItem}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                {shouldNavigateToFirstSubItem ? (
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={item.title}
                                        isActive={hasActiveSubItem}
                                    >
                                        <Link href={firstSubItemUrl!}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </Link>
                                    </SidebarMenuButton>
                                ) : (
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            tooltip={item.title}
                                            isActive={hasActiveSubItem}
                                        >
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                )}
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items?.map((subItem) => {
                                            const isSubItemActive = pathname === subItem.url

                                            return (
                                                <SidebarMenuSubItem key={subItem.key}>
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        isActive={isSubItemActive}
                                                    >
                                                        <Link href={subItem.url}>
                                                            <span>{subItem.title}</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )
                                        })}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
