"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { getBestActiveRoute, isRouteActive } from "@/lib/navigation/route-active"
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

type NavItem = {
    key: string
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: { key: string; title: string; url: string }[]
}

function NavMainCollapsibleItem({
    item,
    pathname,
    sidebarState,
}: {
    item: NavItem
    pathname: string
    sidebarState: "expanded" | "collapsed"
}) {
    const activeSubItemUrl = item.items
        ? getBestActiveRoute(
              pathname,
              item.items.map((subItem) => subItem.url),
          )
        : undefined
    const isItemActive = isRouteActive(pathname, item.url)
    const isGroupActive = isItemActive || Boolean(activeSubItemUrl)
    const firstSubItemUrl = item.items?.[0]?.url
    const shouldNavigateToFirstSubItem =
        sidebarState === "collapsed" && Boolean(firstSubItemUrl)

    const [isOpen, setIsOpen] = useState(isGroupActive)

    useEffect(() => {
        if (isGroupActive) {
            setIsOpen(true)
        }
    }, [isGroupActive])

    return (
        <Collapsible
            asChild
            open={isOpen}
            onOpenChange={setIsOpen}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                {shouldNavigateToFirstSubItem ? (
                    <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isGroupActive}
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
                            isActive={isGroupActive}
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
                            const isSubItemActive = subItem.url === activeSubItemUrl

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
}

export function NavMain({
    items,
}: {
    items: NavItem[]
}) {
    const pathname = usePathname()
    const { state } = useSidebar()

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const hasSubItems = (item.items?.length ?? 0) > 0
                    const isItemActive = isRouteActive(pathname, item.url)

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
                        <NavMainCollapsibleItem
                            key={item.key}
                            item={item}
                            pathname={pathname}
                            sidebarState={state}
                        />
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
