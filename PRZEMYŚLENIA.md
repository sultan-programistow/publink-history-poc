# Trzy decyzje

_...których zadanie nie wymuszało a które podjąłeś, każdą uzasadnioną wartością dla skarbnika lub biznesu, nie elegancją
techniczną._

Nie podjąłem takich decyzji.

Trudno mi było się odnaleźć w takim wyimaginowanym scenariuszu, brakowało mi:
* pozostałej części aplikacji (żeby sprawdzić, jak do tej pory Skarbnik "interaktuje" z dokumentami)
* zrozumienia jak właściwie są modelowane dokumenty i które z ich pod-obiektów są istotne (typu faktura, kontraktor, obligacje)
  – co z tego jest potrzebne Skarbnikowi przy kontroli z RIO a co być może nie
* możliwości dopytania Skarbnika (być może nie bezpośrednio, bo np. transkrypt z user calla byłby wystarczający) 
  co dokładnie myśli, że potrzebuje z historii umów przy kontroli RIO

# Co widziałem w necie

Trochę zbiorczych analiz odnośnie kontroli RIO (ale nie konkretne pojedyncze przypadki), przykład:
* https://www.portalsamorzadowy.pl/finanse/tysiac-kontroli-i-10-tysiecy-nieprawidlowosci-z-tym-samorzady-sobie-nie-radza,391883.html?mp=promo

Znalazłem też - w mojej ocenie najbliższe tego, czego szukałem - wypowiedzi na facebooku realnych ludzi-urzędników:
* https://www.facebook.com/groups/863864864036844/posts/2466507277105920/

^ stąd rozumiem, że kontrole RIO odbywają się przeciętnie raz na 4 lata - zapewne audit log powinien być przynajmniej tak długi

Ale tego za mało znalazłem, żeby się na tym mocno oprzeć.

# Modelowanie chatem GPT

Skoro nie mam dostępu do rzeczywistego użytkownika, to niech chociaż GPT mi coś podpowie.
Poprosiłem go w dwóch one-shotach o coś w stylu: "Wyobraź sobie, że jesteś urzędnikiem/kontrolerem, przygotowujesz
się do kontroli RIO, jakie funkcje systemu do obsługi umów byłby ci potrzebne w zakresie
historii zmian w umowach" - żeby chociaż AI mi pomogła naszkicować problematykę takich kontroli i
co może na nich spotkać urzędnika.

Nie polecam tego robić, ale możecie prześledzić moje pytania i odpowiedzi AI tutaj:
* https://chatgpt.com/share/6a915561-f428-83eb-8de7-ce7248bed309
* https://chatgpt.com/c/6a90493e-2a14-83eb-b006-6bbd3ada68f6

Jeden z ciekawych tam zawartych pomysłów byłoby umożliwienie urzędnikowi odpytywania systemu
poprzez zadawanie ludzkich pytań w stylu:  

🔎 Kto zmienił wartość umowy?  
🔎 Pokaż wszystkie zmiany dokonane po podpisaniu.  
🔎 Co zmieniło się między wersją 2 a wersją 7?  
🔎 Kto miał dostęp do umowy 15 marca?  
🔎 Pokaż wszystkie operacje Jana Kowalskiego dotyczące tej umowy.  

Czyli pewnie na stronie z historią zmian dokumentu/ów przydałaby się ramka (np. po prawej stronie)
do swobodnej konwersacji z systemem, coś np. a'la Atlassianowe Rovo w środku ich produktów:
https://support.atlassian.com/rovo/docs/accessing-chat/. Nie podjąłem się zaimplementowania czegoś takiego.

# Trzy decyzje (jeszcze raz)

Nie podjąłem decyzji **uzasadnionych wartością dla skarbnika lub biznesu** - bo nie "czułem" ani
Skarbnika ani biznesu. Natomiast podjąłem następujące decyzje, których zadanie w sumie nie wymuszało:

* dodałem informację o najstarszym auditlogu w bazie danych (na dole strony). Jakoś tak podejrzewam, że te logi
są rotacyjnie czyszczone co kilka lat, i może to być istotna informacja dla urzędnika, że pełnego 4-letniego okresu nie 
da rady pokazać kontrolerowi

# Co odpuściłem świadomie

* ładnego diffa - w momencie przeglądania audit logów typu "Update" fajnie by było zobaczyć
co dokładnie się zmieniło, a nie surowe oldValue (json) i newValue (json) - i masz tu urzędniku
sam sobie oczami skanuj co jest inaczej. Jakiś np. side-by-side view z czerwonym/zielonym zaznaczonym
fragmentem. +/-
* ogólnie UX'u przy przeglądaniu auditlogów - brakuje możliwości filtrowania po właściwościach AudytLogów,
brakuje czegoś w stylu "collapse/expand all" itp itd.
* sprawdzania uprawnień - aktualny PoC (bo to nawet nie jest MVP) umożliwia dostęp do wszystkich
danych z testowej bazy danych, nie respektując organizacji użytkownika ani innych dodatkowych schematów
uprawnień
* analytika (typu urzędnik kliknął w expand/collapse)

Wszystkie te rzeczy odpuściłem głównie ze względu na to, że
a) czas
b) bardzo mocno nie jestem pewien sensowności tego co robię - bez dostępu do realnych danych
(użytkownik! analityki! produkt! reszta zespołu!) ciężko mi dodawać kolejne mini-funkcje wiedząć,
że na 99% nie takie będą przydatne wyimaginowanemu użytkownikowi

# Pytania?

Chętnie doprecyzuję jesli coś nie jest jasne. Adres znacie?