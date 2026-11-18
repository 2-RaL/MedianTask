# Məhsul müqayisəsi və Meridian üçün seçimlər

17 noyabr 2026. Səkkiz iş idarəetmə platformasının rəsmi sənədləri və məhsul materialları üzrə seçilmiş funksiyaların müqayisəsi.

| Platforma | Nəzərdən keçirilən imkan | Meridian üçün qərar |
| --- | --- | --- |
| [Jira](https://support.atlassian.com/jira-software-cloud/docs/monitor-work-in-a-kanban-project/) | Kanban lövhəsində mərhələlər üzrə işin izlənməsi | Dörd mərhələ, kartın sürüklənməsi və menyudan statusun dəyişməsi. |
| [monday.com](https://support.monday.com/hc/en-us/articles/23716681570578-Work-Management-for-Enterprise) | Layihələrarası göstəricilər və resursların idarə edilməsi | Şirkət səviyyəsində icra göstəriciləri və əməkdaş üzrə açıq iş sayı. |
| [HubSpot](https://knowledge.hubspot.com/tasks/use-task-queues) | Tapşırıqların növbələr üzrə qruplaşdırılması və süzülməsi | İşləri layihəyə və prioritetə görə süzmək, şəxsi tapşırıq siyahısını açmaq. |
| [ClickUp](https://help.clickup.com/hc/en-us/articles/6310424201751-Use-views-on-the-mobile-app) | Eyni işə siyahı və lövhə daxil olmaqla müxtəlif baxışlar | Lövhə və siyahı eyni tapşırıq qeydini göstərir. |
| [MeisterTask](https://support.meistertask.com/hc/en-us/sections/7935441536018-Advanced-Features) | Kanban, hesabatlar və komandanın iş yükü | Bir ekranda layihələrin icra faizi və əməkdaşların açıq tapşırıqları. |
| [Trello](https://trello.com/en-US/guide/enterprise/trello-basics) | Lövhə, siyahı, kart və kartın detalları | Kartın üzündə qərar vermək üçün layihə, prioritet, tarix və məsul şəxs görünür. Təsvir və şərhlər kart açıldıqda görünür. |
| [Asana](https://forum.asana.com/t/switching-from-boards-to-list-view-and-vice-versa/979) | Lövhə ilə siyahı arasında keçid | Görünüş dəyişəndə aktiv süzgəclər saxlanır. |
| [Linear](https://linear.app/learn/insights-and-analytics) | İşin gedişatını say göstəriciləri ilə izləmək | Cari komanda göstəricilərini faktiki tapşırıqlardan hesablamaq. Sprint və dövr proqnozları bu versiyaya daxil edilməyib. |

## Texnologiya və görünüş

[React buraxılışları](https://react.dev/versions) və [Vue 3](https://vuejs.org/guide/introduction.html) nəzərdən keçirildi. Bir ZIP-dən lokal və Node.js hostinqində eyni frontend-i işə salmaq üçün Vue 3 seçildi. Vue 3.5.13 runtime və şablon kompilyatoru arxivə daxil edilib. [Node.js SQLite](https://nodejs.org/api/sqlite.html) ayrıca verilənlər bazası xidmətinə ehtiyac olmadan tranzaksiyaları və daimi yaddaşı təmin edir.

Tünd yaşıl yan menyu sabit istiqamətləndirmə nöqtəsidir. Fil sümüyü iş səthi kartın mətnini ön plana çıxarır. Bürünc vurğular bölmə adlarında və giriş səhifəsində istifadə olunur. Noto Serif başlıqlar və Open Sans interfeys mətni Azərbaycan əlifbasını dəstəkləyir. Mərhələ və prioritetlər rənglə yanaşı mətnlə ifadə olunur. Cihazda hərəkətin azaldılması aktiv olduqda interfeys keçid animasiyalarını söndürür.
