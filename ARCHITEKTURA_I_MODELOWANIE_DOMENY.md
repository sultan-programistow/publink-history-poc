# Architektura i Modelowanie Domeny

_Za 6 miesięcy portfolio modułów rośnie o Podatki i Dotacje, audit przestaje pochodzić z jednej bazy SQL. Co byś zmienił
w architekturze audit loga, KIEDY uruchamiasz zmianę, a czego celowo NIE robisz teraz i dlaczego? Spójność
rozproszona bez ACID, kiedy aneks zapisany a harmonogram nie, to część odpowiedzi. Przedstaw w wygodnej formie,
przeprowadzisz nas przez tok myślenia na rozmowie._

## Moja odpowiedź

Nie mam pojęcia. Nie dam rady – nawet biorąc pod uwagę, że to tylko hipotetyczne zadanie rekrutacyjne
nie mające dalszego sensu – zaproponować dobrego rozwiązania. Przychodzą mi do głowy
różne wzorce projektowe, podziały na domeny kontekstowe itp., itd. Tyle że to wszystko można sobie z byle czata gpt wyczytać.
A problem – przynajmniej dla mnie – jest taki, że
* nie rozumiem ani domeny JST (i nie potrafię w tych 1-2h przeznaczonych
na to zadanie rekrutacyjne skutecznie się podszkolić - no trudno)
* ani jaki tutaj problem chcemy zaadresować. 

To drugie pewnie wynika z pierwszego.

Bo czy to nie jest moment, żeby zacząć modelować co to jest "Audit" w naszym produkcie (a może to już
jest zamodelowane?)

Według ChataGPT (https://chatgpt.com/share/6a918a5e-e3f8-83eb-b817-134cedeb583d) w Waszym systemie:

> ### A. Historia biznesowa — jest
>
>  Przykłady:
>
> * aneksy do umów,
> * kolejne zmiany budżetowe,
> * zmiany planów finansowych jako osobne dokumenty,
> * kolejne dokumenty WPF,
> * kopie dokumentów.
>
> Dzięki nim można często odtworzyć jak zmieniała się sytuacja biznesowa.
> 
> ### B. Ślady konkretnych operacji — częściowo są
> 
> Najbardziej konkretny przykład:
> 
> w Publink można ustalić, z którego konta dokonano publikacji umowy do CRU.
> 
> ### C. Uniwersalny audit trail per encja — nie znalazłem
> 
> Nie widzę w dokumentacji mechanizmu w rodzaju:
> 
> Historia zmian
> 
> z listą:
>
> | Data             | Użytkownik | Encja       | Pole    | Stara wartość | Nowa wartość     |
> |------------------|------------|-------------|---------|---------------|------------------|
> | 12.06.2026 14:32 | Anna       | Umowa   123 | Kwota   | 100 000       | 120 000          |
> | 12.06.2026 14:35 | Anna       | Umowa   123 | Status  | Przygotowanie | Do kontrasygnaty |

Okej, czyli jakaś tam "Historia biznesowa" już jest w istniejącym produkcie. Na czym ona polega?
Czy właśnie na takim mechanizmie co pokazaliście w zadaniu testowym (czyli osobnej tabeli AuditLog która
odkłada JSONy dla każdej operacji CRUD w wyznaczonych tabelach)? Czy może inaczej ta logika jest
zaimplementowana, w oparciu o inne ślady/dane?

Czy też budujemy właśnie "C - uniwersalny audit trail". Ale to wtedy dla kogo robimy? Dla
Skarbnika? Po co Skarbnikowy taki uniwersalny audit trail? On jest także adminem konta jego/jej całej JST?

Czy też robimy to dla nas, bo np. chcemy wejść w jakąś certyfikację typu ISO / SOC2? Albo szykujemy
się na upublicznienie trust center i dlatego chcemy móc się pochwalić "C - uniwersalne audit logi"?

### Pochodzenie danych

Piszecie _"Audit przestaje pochodzić(...)"_

Co rozumiemy jako Audit? Właśnie takie logi z operacji CRUD na biznesowych tabelach? Wraz z jsonem pokazującym
które dokładnie pola się pozmieniały?

Piszecie _"(...) przestaje pochodzić z jednej bazy SQL"_

A z czego zaczyna pochodzić? Z dwu baz SQL? Z trzech? Z wielu? Z innych źródeł? Kto zarządza tymi bazami i źródłami? 
Ja? Inny zespół? Inna organizacja? Czy mamy swobodny dostęp do tej bazy czy raczej nieswobodny? (możemy ją psuć i orać, czy
to raczej jurysdykcja innego zespołu, niekoniecznie mającego czas dla nas i naszych potrzeb?)

### Co to jest ANEKS i co to jest HARMONOGRAM

Rozumiem, że są to jakieś obiekty domenowe i ten pierwszy zakładacie, że jest w jednym
mikroserwisie/bazie danych, a ten drugi jest w nowopowstającym (odseparowanym) miejscu. Pewnie w tym
module "Podatki i Dotacje". BTW: to jest w ogóle jeden moduł, czy dwa osobne: "Podatki" oraz drugi "Dotacje"?

# Warianty

Ja widzę dwa warianty problemu/rozwiązania.

Albo budujemy pod kątem **"C. Uniwersalny audit trail"** / SOC / TrustCenter itp, czyli dla siebie.

Albo budujemy pod kątem **"A. Historia biznesowa""**, czyli dla użytkownika produktu, dla Skarbnika

## Wariant pod C. uniwersalny audit trail

Ja bym zostawił tak jak jest. Tzn. każda baza danych/domena, która kontroluje obiekty biznesowe (typu Aneks, Harmonogram)
niech sobie prowadzi AuditLogi na własny rachunek. To nam świetnie załatwia niezawodność i wydajność zapisywania tych logów.
Super, to brakuje nam tylko wydajnego i niezawodnego sposobu odpytywania o te logi. I wydaje mi się, żebym zaproponował
zbudowanie jakiegoś mini-panelu admina (nie wiem gdzie - może jako osobne coś, a może w ramach jednego z istniejących
już produktów, żeby zobaczyć jak to będzie działać), który by na żądanie operatora tego panelu odpytywał interesujące
bazy danych. Jeśli rozwiązanie takie zacznie nam biznesowo ciążyć (bo np. obsługa żądań audit trail za dużo by kosztowała
pracy supportu czy naszej) (choć kurcze, kto by wymagał tak częstych audit traili? zewnętrzny audytor?) to wtedy
można by pomyśleć o migracji (a właściwie replikacji) danych audytowych na jakiś szybszy/wydajniejszy system. Taki np.
Snowflake czy inny ClickHouse. ChatGPT podpowiada mi taką architekturę:

                ┌──────────────┐         ┌────────────────────┐
                │ SaaS App     │         │ SaaS App           │
                │ moduł ANEKSY │         │ moduł HARMONOGRAMY │
                └──────┬───────┘         └──────────┬─────────┘
                       │                            │
                       ▼                            ▼
                ┌──────────────┐             ┌──────────────┐
                │ DB           │             │ DB           │
                │ PostgreSQL   │             │ PostgreSQL   │
                └──────┬───────┘             └──────┬───────┘
                       │                            │
                       │ audit event                │ audit event
                       ▼                            ▼
                ┌──────────────┐             ┌──────────────┐
                │ Outbox / CDC │             │ Outbox / CDC │
                └──────┬───────┘             └─┬────────────┘
                       │                       │
                  async / batch           async / batch
                       │                       │
                       ▼                       ▼
                     ┌──────────────────────────┐
                     │    Snowflake             │
                     │                          │
                     │    RAW audit events      │
                     │           ↓              │
                     │    transformed tables    │
                     └──────────────────────────┘
                                 │
                                 ▼
                           SQL / BI / API




## Wariant pod A. Historia biznesowa

Tutaj po pierwsze trzeba by było się zaznajomić co już aktualnie mamy, jakie funkcje już udostępniamy, do czego
przyzwyczailiśmy użytkowników. Ale zakładam, że to będą jakieś miejsca w aplikacji w UI, gdzie użytkownik
może sobie przeglądać dotyczące go (lub jego zasobów) auditlogi. I bardzo czuję, że chcecie, aby
gdzieś w UI jednego produktu (np. w widoku ANEKSU) pojawiała się historia biznesowa HARMONOGRAMÓW (czyli
tych obiektów z drugiego modułu/produktu).

Czy my możemy zatem sobie porządnie wymodelować co to jest ta Historia Biznesowa? Bo czuję, że to nie będzie
idealnie 1:1 do tego, co robi aktualnie AuditLog (oraz co my, operatorzy tego SaaSa z tymi logami robimy: rotacje, hydracje, migracje itp.)
Pewnie Historia Biznesowa będzie miała jakieś swoje reguły biznesowe, typu retencja logów, exporty, migracje,
specyficzny permission scheme - różnie. To może ugryźmy ten pocisk i rozbudujmy istniejącą Historię Biznesową (jeśli jest :))
o możliwość przyjęcia Zmian Biznesowych ze zdalnego modułu.

I bardzo mi się wydaje, że architektura jak powyżej (do Snowflake'a) byłaby pasująca. Tylko żeby te Outboxy
wysyłały AuditEventy nie do Snowflake, tylko do nas, np. do Modułu ANEKSY (później to można wydzielić do 
osobnego modułu jak zajdzie potrzeba - ale zakładam, że w Aneksach już jest jakaś infrastruktura do "Historii biznesowej"
i to tam najłatwiej będzie wbić łopatę).

### Pytacie: _"Spójność rozproszona bez ACID, kiedy aneks zapisany a harmonogram nie"_

Ja myślę, że AuditLogi nie są od zapewnienia tej spójności. Wydaje mi się, że auditlogi mają
pokazać prawdę o tej spójności. Czyli jeśli ANEKS się zapisał a HARMONOGRAM nie, to według mnie
jest OK, że audit logi pokażą coś w stylu:

```
CorrelationId: XYZ
   
✓ AnnexCreated
✓ ContractValueChanged
✓ PaymentScheduleRequested
✗ PaymentScheduleCreationFailed <-- tego nie pokażą, dla ilustracji co się stało tego "loga" tu dodałem
```

To warstwa biznesowa zdecydować, co w takiej sytuacji robić (retry? cofnąć ANEKS? ustawić dodatkowy status?)

Pattern z outboxem powinien nam zapewnić "Eventual consistency" - być może w pierwszej sekundzie
po utworzeniu HARMONOGRAMU w auditlogach będzie widać, że jeszcze się nie stworzył, ale w końcu kolejki/eventy
dojdą tam gdzie trzeba i audit logi w module ANEKS będą miały odpowiednie dane.

### Pytacie: _"KIEDY uruchamiasz zmianę, a czego celowo NIE robisz teraz i dlaczego?"_

Myślę, że można TERAZ zacząć pracować nad "kontraktem" tych AuditLogów (a właściwie Historii Biznesowych), które
będą spływać do tego naszego wewnętrznego Snowflake'a. One pewnie będą na początku mocno przypominać to co
jest w tabeli AuditLog, ale być może jakieś dodatkowe biznesowe reguły tam dojdą. Retencja? Uprawnienia? CorrelationId już mamy,
ale pewnie jakiś CausationId i EventId też byśmy chcieli przechowywać. Żeby móc potem taką diagnostykę robić:
```
OperationId: OP-123

Contract Service:
Event: AnnexCreated
EventId: E1

Payment Service:
Event: PaymentScheduleRequested
CausationId: E1
EventId: E2

Payment Service:
Event: PaymentScheduleCreationFailed
CausationId: E2
EventId: E3
```
Dzięki temu możemy odtworzyć:
```
Aneks
└── wygenerował żądanie harmonogramu
       └── które zakończyło się błędem
```
Ale nie wiem czy coś po za tym na chwilę obecną bym robił. Dopiero gdy się pojawi ten drugi niezależny
kontekst/mikroserwis/baza danych, to wtedy bym zaczął dodawać Outboxy, message brokery czy co tam jeszcze potrzebować będziemy.
A dane historyczne bym migrował jakoś w tle. Bo przez 6 miesięcy może się wiele zdarzyć. Jeszcze priorytety się 
pozmieniają i te całe AuditLogi wypadną z roadmapy. Albo zmienią się wymagania biznesowe i może uda nam się
przeżyć bez migracji starych danych (np. pełny AuditLog tylko w promocji dla nowych użytkowników). Zobaczymy.

